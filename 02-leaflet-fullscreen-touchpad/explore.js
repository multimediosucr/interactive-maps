	/**
	 * Default state
	 * Set initial state with request parm
	 */ 
	var stateObj = { 
		lat: 46.566414,
		lng: 2.4609375,
		zoom: 6,
		selectedPostId: -1
		};
	
	function getRequestParm(name) {
	   if(name=(new RegExp('[?&]'+encodeURIComponent(name)+'=([^&]*)')).exec(location.search)) {
	      return decodeURIComponent(name[1]);
	   }
	   else {
		   return false;
	   }
	}
	
	var viewRequest = getRequestParm('llz');
	if(viewRequest) {
		var splitViewRequest = viewRequest.split(',');
		stateObj.lat = splitViewRequest[0];
		stateObj.lng = splitViewRequest[1];
		stateObj.zoom = splitViewRequest[2];
	}
	
	var postIdRequest = getRequestParm('sel');
	if(postIdRequest) {
		stateObj.selectedPostId = postIdRequest;
	}

	/**
	 * Map creation, controls creation and global variable setting
	 */
	// Create map
	var map = new L.Map('mapCanvas', { 
		zoomControl: false
        });
	L.control.zoom({ position: 'topright'}).addTo(map);
	L.control.scale().addTo(map);
		
	// create the tile layer with correct attribution
	L.tileLayer('https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
	}).addTo(map);
	
	map.setView(new L.LatLng(stateObj.lat, stateObj.lng), stateObj.zoom);

	// Popups
	var tooltipPopup = false;
	var stickyPopup = false;
	
	// Arrays of posts
	var postlist = []; // original dataset
	var markers = {};	// key: postId	
	var postlistToCenter = []; // posts sorted by distance to the center of the map
	var postlistByGlobalId = {}; // key: postId	
	
	// Templates
	var postContentTpl = document.getElementById('postContentTpl').innerHTML;
	var tooltipTpl = document.getElementById('tooltipTpl').innerHTML;
	var stickyTooltipTpl = document.getElementById('stickyTooltipTpl').innerHTML;
	
	// Marker icons
	var markerIcon = L.divIcon({ className : 'circle', iconSize : [ 12, 12 ]});
	var markerHoverIcon = L.divIcon({ className : 'circle hover', iconSize : [ 12, 12 ]});
	var markerSelectedIcon = L.divIcon({ className : 'circle selected', iconSize : [ 12, 12 ]});

	
	// Load data
	$.ajax({
	    url: testdata_url,
	    //jsonpCallback: "processJSON",
	    jsonp: false,
	    dataType: "jsonp"
	}).done(function(data){
	});


	
	// Parse JSON input. Can be called at initial loading or by selecting an input file
	function processJSON(data) {
		postlist = data;
		markers = {};	// key: postId	
		postlistByGlobalId = {}; // key: postId	
		
		for (var i = 0; i < postlist.length; i++) {
			postlist[i].url = "https://www.youtube.com/watch?v=" + postlist[i].youtubeId;
			postlist[i].thumbnail = "https://i.ytimg.com/vi/" + postlist[i].youtubeId + "/hqdefault.jpg";
			var latlng = postlist[i].latlng.split(',');
			postlist[i].lat = latlng[0].trim(); 
			postlist[i].lng =latlng[1].trim();
			var m = L.marker([postlist[i].lat, postlist[i].lng], { icon: markerIcon });
			postlistByGlobalId[postlist[i].guid] = postlist[i];
			m.postId = postlist[i].guid;
			markers[postlist[i].guid] = m; 
			map.addLayer(m);
		}
		
		refreshPostlistView();	
	}
	

	// Map event handlers
	map.on('moveend', function(e) {
		stateObj.lat = map.getCenter().lat.toFixed(6);
		stateObj.lng = map.getCenter().lng.toFixed(6);
		stateObj.zoom = map.getZoom();
		
		updateHistory();
	});
	
	map.on('movestart', function(e) {
		if(tooltipPopup) {
			markers[tooltipPopup.postId]._resetZIndex();
			markers[tooltipPopup.postId].setIcon(markerIcon);
		}
		map.closePopup(tooltipPopup);
		tooltipPopup = false;
	});
	
	map.on('moveend resize', function(e) {
		refreshPostlistView();	
	});

	
	// Marker clicked
	function markerClicked(e) {
		var doShowTooltip = false;
		if (stateObj.selectedPostId == -1) {
			stateObj.selectedPostId = e.target.postId;
			$("div.postContent[data-postId=" + stateObj.selectedPostId + "]").removeClass("hover");
			$("div.postContent[data-postId=" + stateObj.selectedPostId + "]").addClass("selected");
			markers[stateObj.selectedPostId].setIcon(markerSelectedIcon);
			markers[stateObj.selectedPostId]._bringToFront();
		}
		else {
			if(stateObj.selectedPostId == e.target.postId) {
				$("div.postContent[data-postId=" + stateObj.selectedPostId + "]").removeClass("selected");
				$("div.postContent[data-postId=" + stateObj.selectedPostId + "]").addClass("hover");
				markers[stateObj.selectedPostId].setIcon(markerHoverIcon);
				markers[stateObj.selectedPostId]._bringToFront();
				stateObj.selectedPostId = -1;
				doShowTooltip = true;
			}
			else {
				$("div.postContent[data-postId=" + stateObj.selectedPostId + "]").removeClass("selected");
				markers[stateObj.selectedPostId]._resetZIndex();
				markers[stateObj.selectedPostId].setIcon(markerIcon);
				stateObj.selectedPostId = e.target.postId;
				$("div.postContent[data-postId=" + stateObj.selectedPostId + "]").addClass("selected");
				markers[stateObj.selectedPostId].setIcon(markerSelectedIcon);
				markers[stateObj.selectedPostId]._bringToFront();
			}
		}
		
		updateStickyPopup();
		if(doShowTooltip) {
			showTooltip(e.target.postId);
		}
		
		if (stateObj.selectedPostId != -1) { scrollToSelectedOrFirst(); }
		
		updateHistory();
	}
	
	// Center map on postId and make it selected
	function centerMapOnPost(postId) {
		map.setView(markers[postId].getLatLng(), map.getZoom());

		if (stateObj.selectedPostId == -1) {
			stateObj.selectedPostId = postId;
			$("div.postContent[data-postId=" + stateObj.selectedPostId + "]").removeClass("hover");
			$("div.postContent[data-postId=" + stateObj.selectedPostId + "]").addClass("selected");
			markers[stateObj.selectedPostId].setIcon(markerSelectedIcon);
			markers[stateObj.selectedPostId]._bringToFront();
		}
		else {
			if(stateObj.selectedPostId != postId) {
				$("div.postContent[data-postId=" + stateObj.selectedPostId + "]").removeClass("selected");
				markers[stateObj.selectedPostId]._resetZIndex();
				markers[stateObj.selectedPostId].setIcon(markerIcon);
				stateObj.selectedPostId = postId;
				$("div.postContent[data-postId=" + stateObj.selectedPostId + "]").removeClass("hover");
				$("div.postContent[data-postId=" + stateObj.selectedPostId + "]").addClass("selected");
				markers[stateObj.selectedPostId].setIcon(markerSelectedIcon);
				markers[stateObj.selectedPostId]._bringToFront();
			}
		}

		updateStickyPopup();
		
		updateHistory();
	}
		
	// Refresh post listing on page load or when the map has moved
	function refreshPostlistView() {
		
		// Sort it
		postlistToCenter = postlist.sort(function (a, b) {
			a.distanceToCenter = map.distance(map.getCenter(), L.latLng(a.lat, a.lng));
			b.distanceToCenter = map.distance(map.getCenter(), L.latLng(b.lat, b.lng));
			if(a.distanceToCenter > b.distanceToCenter) return 1;
			if(a.distanceToCenter < b.distanceToCenter) return -1;
			return 0;
		});
		
		showTooltip(postlistToCenter[0].guid);
		markers[postlistToCenter[0].guid].setIcon(markerSelectedIcon);
		markers[postlistToCenter[0].guid]._bringToFront();
	}


	// Show tooltip of postId
	function showTooltip(postId) {
		tooltipPopup = new L.Rrose({ offset: new L.Point(0,-10), closeButton: false, autoPan: false });		
		tooltipPopup.setContent(Mustache.render(postContentTpl, postlistByGlobalId[postId]) );
		tooltipPopup.setLatLng(markers[postId].getLatLng());
		tooltipPopup.postId = postId;
		tooltipPopup.openOn(map);
		
		$("div.postContent").on("click", postClicked);
	}
	
	
	// Post div clicked
	function postClicked(e) {
		var postId = $(this).attr("data-postId");

		$(this).append("<div class='loading'>");
		stateObj.selectedPostId = postId;
		updateHistory();

		// track if possible
		if(typeof ga == 'function') { 
			ga('send', 'event', {
			    eventCategory: 'Outbound Link',
			    eventAction: 'click',
			    eventLabel: postlistByGlobalId[postId].title,
			    hitCallback: function() {
			      window.location = postlistByGlobalId[postId].url;
			    }
			  });
		}
		else {
			window.location = postlistByGlobalId[postId].url;
		}
	}

	
	// Close sticky popup and open a new one if needed
	function updateStickyPopup() {
		map.closePopup(tooltipPopup);
		map.removeLayer(stickyPopup);
		
		if(stateObj.selectedPostId != -1 && markers[stateObj.selectedPostId]) {
			// Create popup			
			stickyPopup = new L.Rrose({ offset: new L.Point(0,-10), closeButton: false, autoPan: false, className: 'sticky' });	
			stickyPopup.setContent(Mustache.render(stickyTooltipTpl, postlistByGlobalId[stateObj.selectedPostId]) );
			stickyPopup.setLatLng(markers[stateObj.selectedPostId].getLatLng());
			stickyPopup.postId = stateObj.selectedPostId;
			map.addLayer(stickyPopup);
		}
	}
	
	
	// Search actions (using geonames web services)
	$("#searchform").submit(function( event ) {
		event.preventDefault();
		var query = $("#search").val().trim();
		
		var zipcodePattern = /^(\d{5})?$/;
		
		var items = [];
		if(zipcodePattern.test(query)) {
			var url = "http://api.geonames.org/postalCodeSearchJSON?postalcode=" + query + "&country=FR&maxRows=10&username=franceimage";
			$.getJSON(url, function(data) {	
				if(data.postalCodes.length == 1) {
					var val = data.postalCodes[0];
					map.setView([val.lat, val.lng], 13);
				} else {
					$.each(data.postalCodes, function(key, val) {
						items.push( "<li class='resultItem'><a href='#'  data-lat='" + val.lat + "' data-lng='" + val.lng + "'>" + val.placeName + "</a></li>" );
					});
					populateResults(items);
				}
			});
		}
		else {
			var url = "http://api.geonames.org/searchJSON?fcode=ADM4&country=FR&name_equals=" + encodeURIComponent(query) + "&maxRows=10&lang=en&username=franceimage";
			$.getJSON(url, function(data) {	
				
				if(data.geonames.length == 1) {
					var val = data.geonames[0];
					map.setView([val.lat, val.lng], 13);
				} 
				
				if(data.geonames.length > 1) {
					$.each(data.geonames, function(key, val) {
						items.push( "<li class='resultItem'><a href='#' data-lat='" + val.lat + "' data-lng='" + val.lng + "'>" + val.name + " - " + val.adminName1 + "</a></li>" );
					});
					populateResults(items);
				} 
				
				if(data.geonames.length == 0) {
					var url = "http://api.geonames.org/searchJSON?country=FR&q=" + encodeURIComponent(query) + "&maxRows=10&lang=en&username=franceimage";
					$.getJSON(url, function(data) {	
						if(data.geonames.length == 1) {
							var val = data.geonames[0];
							map.setView([val.lat, val.lng], 13);
						} else {
							$.each(data.geonames, function(key, val) {
								items.push( "<li class='resultItem'><a href='#' data-lat='" + val.lat + "' data-lng='" + val.lng + "'>" + val.name + " - " + val.adminName1 + "</a></li>" );
							});
							populateResults(items);
						}
					});
				}
			});
		}
	
	
		function populateResults(items) {	
			$( "<ul/>", {
			    "class": "",
			    html: items.join( "" )
			  }).appendTo("#searchResults");
			
			$(".resultItem a").click(function(event) {
				event.stopPropagation();
				event.preventDefault();				

				$("#searchResults").html("");
				$("#infoPanel").hide();
				var lat = $(this).data("lat");
				var lng = $(this).data("lng");
				map.setView([lat, lng], 13);
			});
			
			$("#infoPanel").show();
		}
	});
	
	$("#search").bind("mouseup", function(e) {
		setTimeout(function() {
			if($("#search").val() == "") {
				$("#searchResults").html("");
				$("#infoPanel").hide();
			}
		}, 1);
	});
	
	$("#closeInfoPanel").click(function(event) {
		event.stopPropagation();
		event.preventDefault();				

		$("#searchResults").html("");
		$("#infoPanel").hide();
	});
	

	// Utilities
	function updateHistory() {
		// Update history
		var parms = "llz=" + stateObj.lat + "," + stateObj.lng + "," + stateObj.zoom;
		
		if(stateObj.selectedPostId != -1) {
			parms = parms + "&sel=" + stateObj.selectedPostId;
		}
				
		History.replaceState({}, document.title, "?" + parms);				
	}
	
	function scrollToSelectedOrFirst() {
		var success = false;
		var container = $("html,body");
		var padding = parseInt($("#page").css("padding-top")) + parseInt($(".postContent").css("margin-top"));

		if (stateObj.selectedPostId != -1) {
		    var scrollTo = $("div.postContent[data-postId=" + stateObj.selectedPostId + "]");
			
			if(scrollTo.offset()) {
				container.animate({
					scrollTop: scrollTo.offset().top - padding
				});
				success = true;
			}
		}
		
		if(!success) {
		    var scrollTo = $("div.postContent").first();
			
			if(scrollTo.offset()) {
				container.animate({
					scrollTop: scrollTo.offset().top - padding
				});
			}
		}
	}



	
	
	

	