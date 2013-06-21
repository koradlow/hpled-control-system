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

$(document).on('click', '#test_button', function(q) {
	$(this).spectrum( {
			clickoutFiresChange: true,
			showInitial: true,
			showButtons: false,
			showInput: true,
			preferredFormat: "rgb",
		});
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

$(document).on("click", "#contr_save_button", function(event) {
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
});

/* Behavior of "Status" page */
$(document).on("pagebeforeshow", "#status", function(event) {
	getControllers(addControllersToList);
	getLedSets(addLedSetsToList);
});

$(document).on('click', '#controller_list li', function(q) {
	var data_id = $(this).attr('data-id');
	console.log(data_id);
	$('#controller_list .controller').data({'data-id': data_id});
});

$(document).on('click', '#load_button', function(q) {
	data = $('#controller_list .controller').data('json');
	if (data) {
		console.log(data.controller[0].name);
	}
	var url = $(location).attr('host');
	console.log(location.host);
});

/* Helper functions */
function addControllersToList(data) {
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
			list += '<a href=#contr_details>'
			list += data.controller[i].name;
			list += ' (Address:' + data.controller[i].addr + ')';
			list += '</a></li>';
		}
		$("#controller_list").append(list).listview("refresh");
		// Store the json data in the controller list 
		$('#controller_list .controller').data({'json': data});
}

function addLedSetsToList(data) {
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
