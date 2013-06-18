$(document).on("pagebeforeshow", "#home", function(event) {
});

$(document).on("pagebeforeshow", "#status", function(event) {
	$.ajax({
		type: "GET",
		url: "http://localhost:5000/controller",
		data: null,
		dataType: "json",
		success: function(data) {
			console.log(data);
			console.log(data.controller.length);
			for (var i = 0; i < data.controller.length; i++) {
			}
		}
		});
});
