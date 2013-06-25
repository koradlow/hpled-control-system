// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
	var rest = this.slice((to || from) + 1 || this.length);
	this.length = from < 0 ? this.length + from : from;
	return this.push.apply(this, rest);
};

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
 * ################### Controller Details page #########################
 * ---------------------------------------------------------------------*/
$(document).on("pagebeforeshow", "#contr_details", function(event) {
	var data_id = $('#controller_list .controller').data('data-id');
	if (data_id) {
		var json = $('#controller_list .controller').data('json').controller[data_id];
		$('#contr_details #contr_name').val(json.name);
		$('#contr_details #contr_brightness').val(json.brightness).slider("refresh");
		for (var i = 0; i < json.leds.length; i++) {
			var led_div = $('#led'+i);
			$('#led'+i+'_limit').val(json.leds[i].current_limit).slider("refresh");
			$('#led'+i+' p').first().text('Registered to: '+json.leds[i].led_set);
			var rgb_color = "rgb("
				+json.leds[i].color.r + ','
				+json.leds[i].color.g1 + ','
				+json.leds[i].color.b + ')';
			$('#led'+i+' .circle')
				.css('background-color', rgb_color)
				.spectrum( {
					clickoutFiresChange: true,
					showInitial: true,
					showButtons: false,
					showInput: true,
					preferredFormat: "rgb",
					hide: function(color) {
						$(this).css('background-color', color.toRgbString());
					}
				});
			$('#led'+i+' .circle').spectrum("set", rgb_color);
		}
	} else {
		$('#contr_details #contr_name').val(' ');
	}
	
});


// Close the controller details dialog, ignoring updated values
$(document).on("click", "#contr_cancel_button", function(event) {
	$('.ui-dialog').dialog('close');
});

// Get the values from the input elements, update the object representation,
// update the state on the controller, and close the dialog
$(document).on("click", "#contr_save_button", function(event) {
	updateControllerStatus();
	$('.ui-dialog').dialog('close');
});

// Get the values from the input elements, update the object representation,
// update the state on the controller, and keep the dialog open
$(document).on("click", "#contr_apply_button", function(event) {
	updateControllerStatus();
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
	console.log('new-led-set');
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


$(document).on('click', '#controller_list li', function(q) {
	var data_id = $(this).attr('data-id');
	$('#controller_list .controller').data({'data-id': data_id});
});


/* ---------------------------------------------------------------------
 * ####################### Edit LED-Set page ###########################
 * ---------------------------------------------------------------------*/
$(document).on("pagebeforecreate", "#edit_led_set", function(event) {

	// Try to get the most recent state of the RGB Controller
	var controller_json = $('#controller_list .controller').data('json');
	
	if (controller_json) {
		//addLedsToEditLedSetList(controller_json);
	} else {
		alert("No data available");
		return false;
	}
});

$(document).on("pagebeforeshow", "#edit_led_set", function(event) {
	// Try to get the most recent state of the RGB Controller
	var controller_json = $('#controller_list .controller').data('json');
	
	// Update the visual style of the delete button
	$(this).find('#delete_led_set_button').button('refresh');
	
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
$(document).on('focusout', '#new_set_name', function() {
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
 * ######################## Helper functions ###########################
 * ---------------------------------------------------------------------*/
function updateControllerStatus() {
	var data_id = $('#controller_list .controller').data('data-id');
	if (data_id) {
		var json = $('#controller_list .controller').data('json').controller[data_id];
		json.name = $('#contr_details #contr_name').val();
		json.brightness = $('#contr_details #contr_brightness').val();
		for (var i = 0; i < json.led_cnt; i++) {
			json.leds[i].current_limit = $('#led'+i+'_limit').val();
			var color = $('#led'+i+' .circle').spectrum("get").toRgb();
			json.leds[i].color.r = color.r;
			json.leds[i].color.g1 = color.g;
			json.leds[i].color.g2 = color.g;
			json.leds[i].color.b = color.b;
		} 
		putController(json);
	}
}

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
		var divider = $('<li>')
			.attr({'data-role':'list-divider', 'class':'controller'})
			.text("Controllers:");
		$("#controller_list").append(divider);
		var list = "";
		for (var i = 0; i < data.controller.length; i++) {
			list += '<li data-id='+i+'>';
			list += '<a href=#contr_details data-rel="dialog">'
			list += data.controller[i].name;
			list += ' (Address:' + data.controller[i].addr + ')';
			list += '</a></li>';
		}
		$("#controller_list").append(list).listview("refresh");
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
		sucess: function(data) {
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
		success: function(data) {
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
		success: function(data) {
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
		sucess: function(data) {
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
		sucess: function(data) {
			console.log('LED-Set edited');
		}
	});
}

function deleteLedSet(ledSetJson) {
	$.ajax( {
		type: "DELETE",
		url: ledSetJson.uri,
		data: null,
		success: function(data) {
			console.log('LED-Set deleted');
		}
	});
}
