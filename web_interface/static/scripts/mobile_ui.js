/* Add the left side panel menu */
$(document).on('pagebeforecreate', '[data-role="page"]', function() {
	var panel = $('<div>')
		.attr({'id':'menu_panel','data-role':'panel', 'data-position':'left', 'data-display':'reveal'})
		.appendTo($(this));
	var menu = $('<ul>')
		.attr({'id':'menu_panel_entries', 'data-role':'listview', 'data-theme':'d', 'data-divider-theme':'d'})
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
		.attr({'data-icon':'delete'})
		.append($('<a>')
				.attr({'href':'#', 'data-rel':'close'})
				.text("Close"))
		.appendTo(menu);
});

/* Behavior of "Home" page */
$(document).on("pagebeforeshow", "#home", function(event) {
	$('#color_picker').spectrum( {
			clickoutFiresChange: true,
			showInitial: true,
			showButtons: false,
			showInput: true,
			preferredFormat: "rgb",
		});
	$('#color_test').spectrum( {
			clickoutFiresChange: true,
			showInitial: true,
			showButtons: false,
			showInput: true,
			preferredFormat: "rgb",
			hide: function(color) {
				console.log(color.toRgbString());
				$('#color_test').css('background-color', color.toRgbString());
			}
		});
});

$(document).on('click', '#new_set_button', function(q) {
	return true;
});

/* Behavior of "Controller Details" page */
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

/* Behavior of "Status" page */
$(document).on("pagebeforeshow", "#status", function(event) {
	getControllers(addControllersToStatusList);
	getLedSets(addLedSetsToStatusList);
});

$(document).on('click', '#controller_list li', function(q) {
	var data_id = $(this).attr('data-id');
	$('#controller_list .controller').data({'data-id': data_id});
});


/* Behavior of "New LED Set" page */
$(document).on("pagebeforecreate", "#new_led_set", function(event) {
	$('#new_led_set #new_set_name').val('');
	// Try to get the most recent state of the RGB Controller
	var data = $('#controller_list .controller').data('json');
	if (data) {
		addLedsToNewLedSetList(data);
	}
});

/* Helper functions */
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

function addLedsToNewLedSetList(data) {
	var controllers = data.controller;
		// Remove existing old entries
		$('#new_led_set .led_list')
			.children()
			.remove();
		// Create one collapsible list for each controller
		for (var i = 0; i < controllers.length; i++) {
			var controller_item = $('<div>')
				.attr( {'data-role':'collapsible'})
				.append( $('<h2>').text(controllers[i].name) );
			
			var led_list = $('<ul>')
				.attr( {'data-role':'listview'})
				.appendTo(controller_item);
			$('#new_led_set .led_list').append(controller_item)
			
			// Create one list entry per LED channel
			for (var j = 0; j < controllers[i].leds.length; j++) {
				var led_item = $('<li>')
					.attr( {'data-icon':'plus'} )
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
		}
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

function addLedSetsToStatusList(data) {
		// Remove existing controllers in the list
		$('#led_set_list')
			.children()
			.remove();
		var divider = $('<li>')
			.attr({'data-role':'list-divider', 'class':'led_set'})
			.text("LED Sets:");
		$("#led_set_list").append(divider);
		var list = "";
		for (var i = 0; i < data.led_set.length; i++) {
			list += '<li>';
			list += data.led_set[i].name;
			list += '</li>';
		}
		$("#led_set_list").append(list).listview("refresh");
		// Store the json data in the  list 
		$('#led_set_list .led_set').data({'json': data});
}


/* Interaction with REST API */
function putController(controllerJson) {
	$.ajax({
		type: "PUT",
		url: controllerJson.uri,
		data: JSON.stringify(controllerJson),
		contentType: "application/json",
		sucess: function(data) {
			console.log('updated');
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
