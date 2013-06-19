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
});

$(document).on('click', '#test_button', function(q) {
	data = $('#controller_list .controller').data();
	console.log(data.controller[0].name);
});

/* Behavior of "Home" page */
$(document).on("pagebeforeshow", "#contr_details", function(event) {
	var json = $('#controller_list .controller').data('json');
	var data_id = $('#controller_list .controller').data('data-id');
	console.log(json.controller[data_id].name);
});

/* Behavior of "Status" page */
$(document).on("pagebeforeshow", "#status", function(event) {
	requestControllers(addControllersToList);
	requestLedSets(addLedSetsToList);
});

$(document).on('click', '#controller_list li', function(q) {
	var data_id = $(this).attr('data-id');
	console.log(data_id);
	$('#controller_list .controller').data({'data-id': data_id});
});

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

$(document).on('click', '#load_button', function(q) {
	data = $('#controller_list .controller').data('json');
	console.log(data.controller[0].name);
});


function loadController(q) {
	$('#controller_list').listview( "refresh" );
};


/* Interaction with REST API */

function requestControllers(handleDataFunction) {
	/* Request list of controllers */
	$.ajax({
		type: "GET",
		url: "http://localhost:5000/controller",
		data: null,
		dataType: "json",
		success: function(data) {
			handleDataFunction(data);
		}
	});
}

function requestLedSets(handleDataFunction) {
	/* Request list of controllers */
	$.ajax({
		type: "GET",
		url: "http://localhost:5000/led_set",
		data: null,
		dataType: "json",
		success: function(data) {
			handleDataFunction(data);
		}
	});
}
