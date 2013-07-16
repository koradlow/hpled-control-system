// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
	var rest = this.slice((to || from) + 1 || this.length);
	this.length = from < 0 ? this.length + from : from;
	return this.push.apply(this, rest);
};



/* ---------------------------------------------------------------------
 * ########################### Menu Panel ###############################
 * ---------------------------------------------------------------------*/
/* Add the left side panel menu */
$(document).on('pagebeforecreate', '[data-role="page"]', function() {
	var panel = $('<div>')
		.attr({'id':'menu_panel','data-role':'panel', 'data-position':'left', 'data-display':'reveal'})
		.appendTo($(this));
	var menu = $('<ul>')
		.attr({'id':'menu_panel_entries', 'class':'side_panel', 'data-role':'listview', 'data-theme':'d', 'data-divider-theme':'d'})
		.appendTo(panel);
	$('<li>')
		.attr({'data-role':'list-divider'})
		.text('Sections')
		.appendTo(menu);
	$('<li>')
		.append($('<a>')
				.attr({'href':'#home'})
				.text("Home"))
		.appendTo(menu);
	$('<li>')
		.append($('<a>')
				.attr({'href':'#status'})
				.text("Status"))
		.appendTo(menu);
	$('<li>')
		.attr({'data-role':'list-divider'})
		.text('Actions')
		.appendTo(menu);
	$('<li>')
		.append($('<a>')
				.attr({'href':'#edit_led_set', 'data-rel':'dialog'})
				.addClass('create_new_led_set')
				.text("New LED-Set"))
		.addClass('new_led_set')
		.appendTo(menu);
	$('<li>')
	.attr({'data-icon':'delete'})
		.append($('<a>')
				.attr({'href':'#'})
				.text("Reload"))
		.addClass('reload')
		.appendTo(menu);
	$('<li>')
		.attr({'data-icon':'delete'})
		.append($('<a>')
				.attr({'href':'#', 'data-rel':'close'})
				.text("Close"))
		.appendTo(menu);
});

// Insert menu items into side panel dynamically
$(document).on('pagebeforeshow', '[data-role="page"]', function() {
	addLedSetsToPanelMenu();
});

// Reload the current page (Update controller State)
$(document).on('click','#menu_panel li.reload ',function(event, ui){
	$.mobile.changePage(
		'#'+$.mobile.activePage[0].id,
		{
			allowSamePageTransition : true,
			transition              : 'none',
			showLoadMsg             : false,
			reloadPage              : false
		}
	);
});



/* ---------------------------------------------------------------------
 * ########################### Home page ###############################
 * ---------------------------------------------------------------------*/
$(document).on("pagebeforeshow", "#home", function(event) {
});



/* ---------------------------------------------------------------------
 * ########################## Status page ##############################
 * ---------------------------------------------------------------------*/
// Request the current status of the controller via Ajax and display the 
// elements when the call succeeds
$(document).on("pagebeforeshow", "#status", function(event) {
	getControllers(addControllersToStatusList);
	getLedSets(addLedSetsToStatusList);
});

// Intercept clicks to the "new set button" to initialize a new
// "led_set" object and attach it to the "#edit_led_set" page
$(document).on('click', '.create_new_led_set', function(q) {
	// create a new led-set object and append it to the page as data
	var led_set = {
			name : 'undef',
			leds : Array()
			};
	$('#edit_led_set').data('led-set', led_set);
	$('#delete_led_set_button').attr('disabled', '');
	$('#edit_led_set [data-role=header] h1').text('New LED-Set');
	return true;
});

// Intercept clicks on "control LED-Set" list entries to append the correct
// data to the page
$(document).on('click', '.control_led_set', function(q) {
	if ($(this).data('led-set')) {
		var data = $(this).data('led-set');
		$('#control_led_set').data('led-set', data);
		$('#control_led_set [data-role=header] h1')
			.text('Control '+ data.name);
	}
});

// Attach the LED-Set object belonging to the list item to the
// "#edit_led_set" page
// (triggered on a click to the "LED-Set list" on the status page)
$(document).on('click', '.edit_led_set', function(q) {
	var led_set = $(this).data('led-set');
	if (led_set) {
		$('#edit_led_set').data('led-set', led_set);
		$('#delete_led_set_button').removeAttr('disabled');
		$('#edit_led_set [data-role=header] h1').text('Edit LED-Set');
	}	else {
		alert("No data for this LED-Set available");
		return false;
	}
});

// Intercept clicks on "controller_list" list entries to append the correct
// data to the page
$(document).on('click', '#controller_list li', function(q) {
	var controller = $(this).data('controller');
	$('#contr_details').data('controller', controller);
});




/* ---------------------------------------------------------------------
 * ################### Controller Details page #########################
 * ---------------------------------------------------------------------*/
$(document).on("pagebeforeshow", "#contr_details", function(event) {
	// check if the page contains the data of the controller object
	if (!$(this).data('controller')) {
		alert("No Controller Data found");
		$.mobile.changePage("#status");
		return;
	}
	// Get the state of the Controller that will be modified
	var controller = $(this).data('controller');
	
	// Initialize the static fields
	$(this).find('#contr_name').val(controller.name);
	$(this).find('#contr_brightness')
		.val(controller.brightness)
		.slider('refresh');
	
	// Remove the old control blocks
	$(this).find('div.ui-responsive').children().remove();
	
	// Insert a control block for each LED into a responsive grid
	var grid = $(this).find('div.ui-responsive');
	var ui_block_type = ['ui-block-a', 'ui-block-b']
	for (var i=0; i < controller.leds.length; i++) {
		// color string for this LED
		var rgb_color = tinycolor(controller.leds[i].color);
		
		// colored button allowing to set the LED Color
		var led_button = $('<div>')
			.addClass('circle')
			.css('background-color', rgb_color.toRgbString())
				.spectrum( {
					clickoutFiresChange: true,
					showInitial: true,
					showButtons: false,
					showInput: true,
					preferredFormat: "rgb",
					hide: function(color) {
						$(this).css('background-color', color.toRgbString());
						var led = $(this).closest('div .led-status').data('led');
						var controller = $('#contr_details').data('controller');
						controller.leds[led.channel].color = color.toRgb();
					}
				} );
		$(led_button).spectrum("set", rgb_color);
		
		// create & attach new grid-item, offering access to all parameters 
		$('<div>')
			.addClass(ui_block_type[i%2])
			.append($('<div>')
				.addClass('ui-body ui-body-a')
				.append($('<div>')
					.addClass('led-status')
					.append($('<h3>').text('Channel ' + i))
					.append($('<p>').text('Registered to: ' + controller.leds[i].led_set))
					.append($('<label>')
						.attr('for', 'contr_led'+i+'_lim')
						.text('Current Limit (mA)'))
					.append($('<input>')
						.addClass('current_limit')
						.attr( {'type':'range', 'name':'slider', 'id':'contr_led'+i+'_lim',
										'value':controller.leds[i].current_limit, 'min':'50', 'max':'400'} )
						.slider())
					.append(led_button)
					.data( {'led': controller.leds[i], 'id':i} ) ))
			.appendTo($(grid));
	}
	
	// Trigger "page create" event to apply jQuery mobilee markup enhancement
	$(this).trigger('create');
});

// Update the name of the Controller
// (triggered if the "Controller Name" textbox was selected and looses focus
$(document).on('change', '#contr_name', function(event) {
	var controller = $('#contr_details').data('controller');
	controller.name = $(this).val();
});

// Update the current limit of LED, if it was changed 
// (triggered if the "conr_ledx_lim" slider was moved)
$(document).on('slidestop', '#contr_details .current_limit', function(event, ui) {
	var controller = $('#contr_details').data('controller');
	var id = $(this).closest('div .led-status').data('id');
	controller.leds[id].current_limit = $(this).val();
});

//Update the brightness of the controller, if it was changed
// (triggered if the "conr_ledx_lim" slider was moved)
$(document).on('slidestop', '#contr_details #contr_brightness', function(event, ui) {
	var controller = $('#contr_details').data('controller');
	controller.brightness = $(this).val();
});

// Get the values from the input elements, update the object representation,
// update the state on the controller, and close the dialog
$(document).on("click", "#contr_save_button", function(event) {
	var controller = $('#contr_details').data('controller');
	putController(controller);
	$('.ui-dialog').dialog('close');
});
// Get the values from the input elements, update the object representation,
// update the state on the controller, and keep the dialog open
$(document).on("click", "#contr_apply_button", function(event) {
	var controller = $('#contr_details').data('controller');
	putController(controller);
});
// Close the controller details dialog, ignoring updated values
$(document).on("click", "#contr_cancel_button", function(event) {
	$('.ui-dialog').dialog('close');
});





/* ---------------------------------------------------------------------
 * ####################### Edit LED-Set page ###########################
 * ---------------------------------------------------------------------*/
$(document).on("pagebeforecreate", "#edit_led_set", function(event) {
});

$(document).on("pagebeforeshow", "#edit_led_set", function(event) {
	// Update the visual style of the delete button
	$(this).find('#delete_led_set_button').button('refresh');
	
	// Try to get the most recent state of the RGB Controller
	var controller_json = $('#controller_list .controller').data('json');
	if (controller_json) {
		addLedsToEditLedSetList(controller_json);
	} else {
		alert("No data available");
		return false;
	}
	
	var led_set = $('#edit_led_set').data('led-set');
	
	// set the value of the LED-Set Name field:
	$('#edit_led_set #new_set_name').val(led_set.name);
	
	// remove old entries in LED-Set member list 
	$('#edit_led_set #led_set_member_list')
		.children()
		.remove();
	
	// add existing members to the LED-Set member list
	for(var idx = 0; idx < led_set.leds.length; idx++) {
		var led = led_set.leds[idx];
		$('#edit_led_set #led_set_member_list')
			.append( 
					$('<li>')
					.attr('data-icon', 'minus')
					.append($('<a>')
						.attr('href','#')
						.text('addr: ' + led.controller + ' (ch: ' + led.channel + ')'))
					.data('led', led))
			.listview('refresh');
	}
});

// Add a led to the new led set 
// (triggered when an entry of the controller led list is clicked)
$(document).on('click', '#edit_led_set .led_list li', function(event) {
	var led = $(this).data('led');
	// led can only be added when the led doesn't belong to another set yet
	// and a name was defined for the LED set
	if (led.led_set == 'none') {
		// add the led object to the LED-Set
		var led_set = $('#edit_led_set').data('led-set');

		led.led_set = led_set.name;
		led_set.leds.push(led);

		// add a new entry to the led-set led-list listview
		var contr_name = $(this).parent().parent().parent().data('controller').name;
		$('#edit_led_set #led_set_member_list')
			.append( 
					$('<li>')
					.attr('data-icon', 'minus')
					.append($('<a>')
						.attr('href','#')
						.text(contr_name + ' (ch: ' + led.channel + ')'))
					.data('led', led))
			.listview('refresh');
	}
});

// Remove a led from the new led set
// (triggered when an entry of the "led_set_member_list" is clicked)
$(document).on('click', '#edit_led_set #led_set_member_list li', function(event) {
	var led = $(this).data('led');
	led.led_set = 'none';
	var led_set = $('#edit_led_set').data('led-set');
	
	// find the according LED instance in the LED-Set and remove it
	for(var idx = 0; idx < led_set.leds.length; idx++) {
		if(led_set.leds[idx].controller == led.controller && 
			led_set.leds[idx].channel == led.channel) {
			led_set.leds.remove(idx);
			break;
		}
	}
	// remove the item from the listview
	$(this).remove();
	$('#edit_led_set #led_set_member_list').listview('refresh');
});

// Change the name of the led set
// (triggered when the name input field is left)
$(document).on('change', '#new_set_name', function() {
	var led_set = $('#edit_led_set').data('led-set');
	led_set.name = $(this).val();
	
	// update the name in all LEDs belonging to this set
	for(var idx = 0; idx < led_set.leds.length; idx++) {
		led_set.leds[idx].led_set = led_set.name;
	}
	$('#edit_led_set').data('led-set', led_set);
});

// Send the new/updated LED-Set to the server
// (triggered when the "Save" button on the #edit_led_set page is clicked
$(document).on('click', '#edit_led_set .save_button', function(event) {
	var led_set = $('#edit_led_set').data('led-set');
	if(led_set.name === 'undef') {
		alert("Please enter a name for the LED-Set");
		return false;
	}
	if(led_set.leds.length === 0) {
		alert("Please add at least one LED to the LED-Set");
		return false;
	}
	// use POST to create a new LED-Set if there is no URI for the object
	// use PUT to update an existing resource
	if(typeof led_set.uri === 'undefined') {
		led_set.status = 'on';
		postLedSet(led_set);
		$('.ui-dialog').dialog('close');
	} else {
		putLedSet(led_set);
		$('.ui-dialog').dialog('close');
	}
	return true;
}); 

// Delete the LED-Set from the server
// (triggered when the "Delete" button on the #edit_led_set page is clicked
$(document).on('click', '#edit_led_set #delete_led_set_button', function(event) {
	if ($('#edit_led_set').data('led-set')) {
		var led_set = $('#edit_led_set').data('led-set');
		deleteLedSet(led_set);
	}
	$('.ui-dialog').dialog('close');
});




/* ---------------------------------------------------------------------
 * ###################### Control LED-Set page #########################
 * ---------------------------------------------------------------------*/
$(document).on('pagebeforeshow', '#control_led_set', function(event) {
	if(! ($(this).data('led-set'))) {
		alert("No LED-Set Data found");
		$.mobile.changePage("#status");
		return;
	}
	// Get the state of the LED-Set that will be controlled
	var led_set = $(this).data('led-set');
	$(this).find('#led_set_name').val(led_set.name);
	$(this).find('#led_set_live_mode').val('off').slider('refresh');
	$(this).find('#led_set_status').val(led_set.status).slider('refresh');
	$(this).data('live-mode', false);
	
	// Remove the old control blocks
	$(this).find('div.ui-responsive').children().remove();
	
	// Insert a control block for each LED into a responsive grid
	var grid = $(this).find('div.ui-responsive');
	var ui_block_type = ['ui-block-a', 'ui-block-b']
	for (var i=0; i < led_set.leds.length; i++) {
		// color string for this LED
		var rgb_color = tinycolor(led_set.leds[i].color);
		
		// colored button allowing to set the LED Color
		var led_button = $('<div>')
			.addClass('circle')
			.css('background-color', rgb_color.toRgbString())
				.spectrum( {
					clickoutFiresChange: true,
					showInitial: true,
					showButtons: false,
					showInput: true,
					preferredFormat: "rgb",
					hide: function(color) {
						$(this).css('background-color', color.toRgbString());
						var led_set = $('#control_led_set').data('led-set');
						var led_id = $(this).parent().data('id');
						led_set.leds[led_id].color = color.toRgb();
						if ($('#control_led_set').data('live-mode')) {
							putLedSet(led_set);
						}
					}
				} );
		$(led_button).spectrum("set", rgb_color);
		
		// create & attach new grid-item, offering access to all parameters 
		$('<div>')
			.addClass(ui_block_type[i%2])
			.append($('<div>')
				.addClass('ui-body ui-body-a')
				.append($('<div>')
					.addClass('led-status')
					.append($('<h3>').text('LED ' + i))
					.append($('<p>').text('Controller: ' + led_set.leds[i].controller
										+ ', Channel: ' + led_set.leds[i].channel))
					.append($('<label>')
						.attr('for', 'led'+i+'_lim')
						.text('Current Limit (mA)'))
					.append($('<input>')
						.attr( {'type':'range', 'name':'slider', 'id':'led'+i+'_lim',
										'value':led_set.leds[i].current_limit, 'min':'50', 'max':'400'} )
						.slider())
					.append(led_button)
					.data( {'led': led_set.leds[i], 'id':i} ) ))
			.appendTo($(grid));
	}
	
	// Trigger "page create" event to apply jQuery mobilee markup enhancement
	$(this).trigger('create');
});

// enable/disable the live update mode according to the switch position
$(document).on('slidestop', '#led_set_live_mode', function(event, ui) {
	if (this.value === 'on') {
		$('#control_led_set').data('live-mode', true);
	} else {
		$('#control_led_set').data('live-mode', false);
	}
	
});

// switch the LEDs belonging to this LED set off/on
$(document).on('slidestop', '#led_set_status', function(event, ui) {
	var led_set = $('#control_led_set').data('led-set');
	led_set.status = $(this).val();
	if ($('#control_led_set').data('live-mode')) {
		putLedSet(led_set);
	}
});

// Update the name of the LED-Set
// (triggered if the "LED-Set Name" textbox was selected and looses focus
$(document).on('change', '#led_set_name', function(event) {
	var led_set = $('#control_led_set').data('led-set');
	led_set.name = $(this).val();
	if ($('#control_led_set').data('live-mode')) {
		putLedSet(led_set);
	}
});

// Update the current limit of LED, if it was changed 
// (triggered if the "ledx_lim" slider was moved)
$(document).on('slidestop', '#control_led_set [name*="slider"]', function(event, ui) {
	var led_set = $('#control_led_set').data('led-set');
	var id = $(this).closest('div .led-status').data('id');
	led_set.leds[id].current_limit = parseInt($(this).val());
	if ($('#control_led_set').data('live-mode')) {
		putLedSet(led_set);
	}
});

// Send the updated LED-Set to the controller, return to previous page
// (triggered when the "Save" button on is clicked)
$(document).on('click', '#contr_led_save_button', function(event) {
	putLedSet($('#control_led_set').data('led-set'));
	window.history.back();
	return true;
});
// Send the updated LED-Set to the controller, stay on page
// (triggered when the "Apply" button on is clicked)
$(document).on('click', '#contr_led_apply_button', function(event) {
	putLedSet($('#control_led_set').data('led-set'));
	return true;
});
// Discard the changes and return to previous page
// (triggered when the "Cancel" button on is clicked)
$(document).on('click', '#contr_led_cancel_button', function(event) {
	window.history.back();
	return true;
});




/* ---------------------------------------------------------------------
 * ######################## Helper functions ###########################
 * ---------------------------------------------------------------------*/
function addLedsToEditLedSetList(controllerJson) {
	var controllers = controllerJson.controller;
		// Remove existing old entries
		$('#collapsible_led_list')
			.children()
			.remove();
		// Create one collapsible list for each controller
		for (var i = 0; i < controllers.length; i++) {
			var controller_ul = $('<ul>')
				.attr( {'data-role':'listview', 'data-id':i})
			var controller_item = $('<div>')
				.attr( {'data-role':'collapsible'})
				.data('controller', controllers[i])
				.append( $('<h2>').text(controllers[i].name) );
			
			var led_list = $('<ul>')
				.attr( {'data-role':'listview', 'data-id':i})
				.appendTo(controller_item);
			
			// Initialize the newly added jQuery Mobile collapsible Widget
			$('#collapsible_led_list').append(controller_item).trigger('create');
			
			// Create one list entry per LED channel
			for (var j = 0; j < controllers[i].leds.length; j++) {
				var led_item = $('<li>')
					.attr( {'data-icon':'plus'} )
					.data( {'led' : controllers[i].leds[j]} )
					.append( $('<h2>').text("Channel: "+controllers[i].leds[j].channel))
					.append( $('<p>').text("Registered to: "+controllers[i].leds[j].led_set))
					.appendTo(led_list);
				// Make the entry selectable when it's not assigned yet
				if (controllers[i].leds[j].led_set == 'none') {
					var anchor = $('<a>')
						.attr( {'href': '#'})
						.appendTo(led_item);
					}
				}
			$(led_list).listview('refresh');
		};
}


function addControllersToStatusList(data) {
		// Remove existing controllers in the list
		$('#controller_list')
			.children()
			.remove();
		
		// Add a header entry to signal the contents of the list
		var divider = $('<li>')
			.attr({'data-role':'list-divider', 'class':'controller'})
			.text("Controllers:");
		$("#controller_list").append(divider);
		
		// Create one list entry per controller
		for (var i = 0; i < data.controller.length; i++) {
			var controller_item = $('<li>')
					.data('controller', data.controller[i])
					.append($('<a>')
						.attr( {'href':'#contr_details', 'data-rel':'dialog'} )
						.text(data.controller[i].name + ' (Address:' +
									data.controller[i].addr + ')'))
					.appendTo('#controller_list');
		}
		$('#controller_list').listview('refresh');

		// Store the json data in the controller list 
		$('#controller_list .controller').data({'json': data});
}

function addLedSetsToPanelMenu() {
	var active_page = $('#'+$.mobile.activePage[0].id);
	var panel_list = $(active_page).find(':jqmData(role=panel)').find(":jqmData(role=listview)");
	// Remove old entries
	$(panel_list).find('.control_led_set').remove();
	
	// Check if LED-Sets are available and add them to the panel menu
	if ($('#led_set_list .led_set').data('json')) {
		var led_set = $('#led_set_list .led_set').data('json').led_set;
		for (var i = led_set.length-1; i >= 0 ; i--) {
			$(panel_list).find('.new_led_set')
				.after( $('<li>')
					.append($('<a>')
						.attr({'href':'#control_led_set'})
						.addClass('control_led_set')
						.text(led_set[i].name))
					.addClass('control_led_set')
					.data('led-set', led_set[i]));
		}
	}
	$(active_page).find(":jqmData(role=listview)").listview('refresh');
	$(':jqmData(role=panel)').trigger('updatelayout');
}

function addLedSetsToStatusList(data) {
		// Remove existing controllers in the list
		$('#led_set_list')
			.children()
			.remove();
		var divider = $('<li>')
			.attr({'data-role':'list-divider', 'class':'led_set'})
			.text("LED Sets:");
		$("#led_set_list").append(divider);
		for (var i = 0; i < data.led_set.length; i++) {
			var led_set = $('<li>')
				.append($('<a>')
					.attr( {'href':'#control_led_set'} )
					.text(data.led_set[i].name)
						.append($('<span>')
							.addClass('ui-li-count')
							.text(data.led_set[i].leds.length)))
				.append($('<a>')
					.attr( {'href':'#edit_led_set', 'data-rel':'dialog'} )
					.text('Edit LED-Set '+data.led_set[i].name))
				.addClass('edit_led_set')
				.addClass('control_led_set')
				.data('led-set', data.led_set[i])
				.appendTo($('#led_set_list'));
		}
		$('#led_set_list').listview('refresh');
		
		// Store the json data in the  list 
		$('#led_set_list .led_set').data({'json': data});
		
		addLedSetsToPanelMenu();
}


/* ---------------------------------------------------------------------
 * ####################### RESTApi interaction #########################
 * ---------------------------------------------------------------------*/
function putController(controllerJson) {
	$.ajax({
		type: "PUT",
		url: controllerJson.uri,
		data: JSON.stringify(controllerJson),
		contentType: "application/json",
		success: function(data, xml_request, options) {
			console.log('controller updated');
		}
	});
}
 
function getControllers(handleDataFunction) {
	/* Request list of controllers */
	$.ajax({
		type: "GET",
		url: "http://"+ location.host + "/controller",
		data: null,
		dataType: "json",
		success: function(data, xml_request, options) {
			handleDataFunction(data);
		}
	});
}

function getLedSets(handleDataFunction) {
	/* Request list of led sets */
	$.ajax({
		type: "GET",
		url: "http://" + location.host + "/led_set",
		data: null,
		dataType: "json",
		success: function(data, xml_request, options) {
			handleDataFunction(data);
		}
	});
}

function postLedSet(ledSetJson) {
	$.ajax( {
		type: "POST",
		url: "http://"+ location.host + "/led_set",
		data: JSON.stringify(ledSetJson),
		contentType: "application/json",
		success: function(data, xml_request, options) {
			console.log('LED-Set created');
		}
	});
}

function putLedSet(ledSetJson) {
	$.ajax( {
		type: "PUT",
		url: ledSetJson.uri,
		data: JSON.stringify(ledSetJson),
		contentType: "application/json",
		success: function(data, xml_request, options) {
			$('#control_led_set').data('led-set', data);
			console.log('LED-Set edited');
		}
	});
}

function deleteLedSet(ledSetJson) {
	$.ajax( {
		type: "DELETE",
		url: ledSetJson.uri,
		data: null,
		success: function(data, xml_request, options) {
			console.log('LED-Set deleted');
		}
	});
}
