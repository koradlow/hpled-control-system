/* Add the left side panel menu */
$(document).on('pagebeforecreate', '[data-role="page"]', function() {
	var panel = $('<div>')
		.attr({'id':'menu_panel','data-role':'panel', 'data-position':'left'})
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

/* Behavior of "Status" page */
$(document).on("pagebeforeshow", "#status", function(event) {
	$.ajax({
		type: "GET",
		url: "http://localhost:5000/controller",
		data: null,
		dataType: "json",
		success: function(data) {
			console.log(data);
			console.log(data.controller.length);
			// Remove existing controllers in the list
			$('#status .controller_list')
				.children()
				.remove();
			// Add the new set of controllers
			var controller = '<div data-role="collapsible"><h3>Section n</h3></div>'
			for (var i = 0; i < data.controller.length; i++) {
				console.log(controller)
				$('#status .controller_list').append(controller)
			}
		}
		});
});
