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
        zoomControl: false,
		zoomsliderControl: false
        });
	L.control.scale({ position: 'bottomright' }).addTo(map);
	L.control.zoomslider({ position: 'topright' }).addTo(map);
	var sidebar = L.control.sidebar('sidebar').addTo(map);
	
	// create the tile layer with correct attribution
	L.tileLayer('https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
	}).addTo(map);
	
	map.setView(new L.LatLng(stateObj.lat, stateObj.lng), stateObj.zoom);

	// Map event handlers
	map.on('moveend', function(e) {
		stateObj.lat = map.getCenter().lat.toFixed(6);
		stateObj.lng = map.getCenter().lng.toFixed(6);
		stateObj.zoom = map.getZoom();
		
		updateHistory();
	});
	
	map.on('click', function(e) {
		sidebar.close();
		updateStickyPopup();	
	});
	
	map.on('movestart', function(e) {
		sidebar.close();
		var postListContainer = $("#aroundList");
		
		if (postListContainer[0]) {
			postListContainer.empty();
		}
		
		postListContainer = $("#postList");
		
		if (postListContainer[0]) {
			postListContainer.empty();
		}
	});
	
	// Sidebar event handlers
	sidebar.on('content', function(e) {
		if(e.id == 'postList') {
			refreshPostlistView();
		}
		if(e.id == 'aroundList') {
			refreshMarkersAroundView();
		}
	});
	
	sidebar.on('closing', function(e) {
	});

	
	
	// Popups
	var tooltipPopup = false;
	var stickyPopup = false;
	
	// Arrays of posts
	var postlist = []; // original dataset
	var markers = {};	// key: postId	
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


	
	// Parse JSON input
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
			var m = L.marker([latlng[0], latlng[1]], { icon: markerIcon });
			postlistByGlobalId[postlist[i].guid] = postlist[i];
			m.postId = postlist[i].guid;
			markers[postlist[i].guid] = m; 
			initMarker(m);
		}
		
		// initial view
		if(stateObj.selectedPostId != -1 && markers[stateObj.selectedPostId]) {
			markers[stateObj.selectedPostId].setIcon(markerSelectedIcon);
			markers[stateObj.selectedPostId]._bringToFront();
			updateStickyPopup();						
		}
	}
	
	
	// Initialize marker
	function initMarker(m) {
		map.addLayer(m);
		m.on('click', markerClicked);
		m.on('mouseover', function(e) { 
			// Create popup
			if(e.target.postId != stateObj.selectedPostId) {
				showTooltip(e.target.postId);
			}
			// Style marker
			if(e.target.postId != stateObj.selectedPostId) {
				markers[e.target.postId].setIcon(markerHoverIcon);
				markers[e.target.postId]._bringToFront();
			}
		});
		m.on('mouseout', function(e) { 
			// Close popup
			map.closePopup(tooltipPopup);
			// Style marker
			if(e.target.postId != stateObj.selectedPostId) {
				markers[e.target.postId]._resetZIndex();
				markers[e.target.postId].setIcon(markerIcon);
			}
		});
	}


	
	// Marker clicked
	function markerClicked(e) {
		var doShowTooltip = false;
		if (stateObj.selectedPostId == -1) {
			stateObj.selectedPostId = e.target.postId;
			markers[stateObj.selectedPostId].setIcon(markerSelectedIcon);
			markers[stateObj.selectedPostId]._bringToFront();
		}
		else {
			if(stateObj.selectedPostId == e.target.postId) {
				markers[stateObj.selectedPostId].setIcon(markerHoverIcon);
				markers[stateObj.selectedPostId]._bringToFront();
				stateObj.selectedPostId = -1;
				doShowTooltip = true;
			}
			else {
				markers[stateObj.selectedPostId]._resetZIndex();
				markers[stateObj.selectedPostId].setIcon(markerIcon);
				stateObj.selectedPostId = e.target.postId;
				markers[stateObj.selectedPostId].setIcon(markerSelectedIcon);
				markers[stateObj.selectedPostId]._bringToFront();
			}
		}
		
		updateStickyPopup();
		if(doShowTooltip) {
			showTooltip(e.target.postId);
		}
		
		updateHistory();
	}
	
		
	// Refresh post listing
	function refreshPostlistView() {
		var postListContainer = $("#postList");
		
		if (postListContainer[0]) {
			postListContainer.empty();
		
			for (var i = 0; i < postlist.length; i++) {
				if(map.getBounds().contains(markers[postlist[i].guid].getLatLng())) {
					postlist[i].lazyload = true;
					postListContainer.append( Mustache.render(postContentTpl, postlist[i]) );				
				}
			}

			bindPostContentEvents(postListContainer);
		}
	}
	
	
	// Refresh view
	function refreshMarkersAroundView() {
		var postlistToCenter = postlist.slice(0); // clone
			
		postlistToCenter.sort(function (a, b) {
			a.distanceToCenter = map.distance(map.getCenter(), L.latLng(a.lat, a.lng));
			b.distanceToCenter = map.distance(map.getCenter(), L.latLng(b.lat, b.lng));
			if(a.distanceToCenter > b.distanceToCenter) return 1;
			if(a.distanceToCenter < b.distanceToCenter) return -1;
			return 0;
		});

		var postListContainer = $("#aroundList");
		
		if (postListContainer[0]) {
			postListContainer.empty();
		
			for (var i = 0; i < postlistToCenter.length; i++) {
				if(map.getBounds().contains(markers[postlistToCenter[i].guid].getLatLng())) {
					postlistToCenter[i].lazyload = true;
					postListContainer.append( Mustache.render(postContentTpl, postlistToCenter[i]) );				
				}
			}

			bindPostContentEvents(postListContainer);
		}
	}
	

	// Bind events to postContent 
	function bindPostContentEvents(container) {
		// add event handlers
		$("img.lazy").lazyload({
			container: container,
			effect : "fadeIn",
			skip_invisible  : true
		});
		
		$("div.postContent").on("click", postClicked);
		
		$("div.postContent").on("mouseenter", function(e) {
			var postId = $(this).attr("data-postId");
			if(postId != stateObj.selectedPostId) {
				tooltipPopup = L.responsivePopup({ offset: new L.Point(10,10), closeButton: false, autoPan: false, className: 'tooltip' });	
				var title = postlistByGlobalId[postId].title;
				tooltipPopup.setContent(title);
				tooltipPopup.setLatLng(markers[postId].getLatLng());
				tooltipPopup.openOn(map);

				
				markers[postId].setIcon(markerHoverIcon);
				markers[postId]._bringToFront();
				$(this).addClass('hover');
			}
		});
					
		$("div.postContent").on("mouseleave", function(e) {
			var postId = $(this).attr("data-postId");
			$(this).removeClass('hover');
			if(postId != stateObj.selectedPostId) {
				map.closePopup(tooltipPopup);

				markers[postId]._resetZIndex();
				markers[postId].setIcon(markerIcon);
			}
		});
		
	}

	
	// Post div clicked
	function postClicked(e) {
		var postId = $(this).attr("data-postId");

		centerMapOnPost(postId);
	}
	

	// Show tooltip of postId
	function showTooltip(postId) {
		tooltipPopup =  L.responsivePopup({ offset: new L.Point(10,10), closeButton: false, autoPan: false });		
		tooltipPopup.setContent(Mustache.render(tooltipTpl, postlistByGlobalId[postId]) );
		tooltipPopup.setLatLng(markers[postId].getLatLng());
		tooltipPopup.openOn(map);
	}
	
	
	// Close sticky popup and open a new one if needed
	function updateStickyPopup() {
		map.closePopup(tooltipPopup);
		map.removeLayer(stickyPopup);
		
		if(stateObj.selectedPostId != -1 && markers[stateObj.selectedPostId]) {
			// Create popup			
			stickyPopup =  L.responsivePopup({ offset: new L.Point(10,10), closeButton: false, autoPan: false, className: 'sticky' });	
			postlistByGlobalId[stateObj.selectedPostId].lazyload = false;
			stickyPopup.setContent(Mustache.render(stickyTooltipTpl, postlistByGlobalId[stateObj.selectedPostId]) );
			stickyPopup.setLatLng(markers[stateObj.selectedPostId].getLatLng());
			stickyPopup.postId = stateObj.selectedPostId;
			map.addLayer(stickyPopup);
		}
	}
	
	
	// Center map on postId and make it selected
	function centerMapOnPost(postId) {
		map.setView(markers[postId].getLatLng(), map.getZoom());

		if (stateObj.selectedPostId == -1) {
			stateObj.selectedPostId = postId;
			markers[stateObj.selectedPostId].setIcon(markerSelectedIcon);
			markers[stateObj.selectedPostId]._bringToFront();
		}
		else {
			if(stateObj.selectedPostId != postId) {
				markers[stateObj.selectedPostId]._resetZIndex();
				markers[stateObj.selectedPostId].setIcon(markerIcon);
				stateObj.selectedPostId = postId;
				markers[stateObj.selectedPostId].setIcon(markerSelectedIcon);
				markers[stateObj.selectedPostId]._bringToFront();
			}
		}

		updateStickyPopup();
		
		updateHistory();
	}
	
	// Follow Link
	function followLinkFromPost(postId) {
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



	
	
	

	