function api_test(url, type, data, async, callback ) {
	$.ajax( {
			url: url,
			type: type,
			contentType: 'application/json; charset=utf-8',
			data: JSON.stringify(data),
			dataType: 'json',
			async: async,
		})
		.done( function (json, textStatus, jqXHR) {
			callback(json, jqXHR);
		})
		.fail( function (jqXHR, status, statusText) {
			callback(jqXHR.responseJSON, jqXHR);
			}
		);
}

/* ---------------------------------------------------------------------
 * ################### Controller API test module ######################
 * -------------------------------------------------------------------*/

/* to run the test suite at least one controller object needs to be available */
module("Controller API", {
	setup: function() {
		var me = this;
		this.url = "http://"+ location.host + "/controller";
		api_test(this.url, 'GET', null, false, function(json, jqXHR) {
			ok( jqXHR.status == 200, "Connected to Controller API");
			ok(json.controller.length > 0, "Controller objects available");
			me.controller_list = json;
		});

	}
});

test("Controller attributes complete?", function() {
	ok(this.controller_list.controller[0].name, "Controller has name");
	ok(this.controller_list.controller[0].addr, "Controller has address");
	ok(this.controller_list.controller[0].led_cnt, "Controller has led count");
	ok(this.controller_list.controller[0].leds, "Controller has LEDs");
	var brightness = this.controller_list.controller[0].brightness;
	ok(brightness >= 0 && brightness <=255, "Controller has brightness");
});

test("LED count complete?", function() {
	var led_count = this.controller_list.controller[0].led_cnt;
	ok(this.controller_list.controller[0].leds.length == led_count, "Correct LED number");
});

test("LED attributes complete?", function() {
	ok(this.controller_list.controller[0].leds[0].current_limit, "LED has current limit");
	ok(this.controller_list.controller[0].leds[0].controller, "LED has controller");
	ok(this.controller_list.controller[0].leds[0].led_set, "LED has LED-Set");
	ok(this.controller_list.controller[0].leds[0].color, "LED has color");
	var channel = this.controller_list.controller[0].leds[0].channel;
	var led_count = this.controller_list.controller[0].led_cnt;
	ok(channel >=0 && channel < led_count, "LED has channel");
});

test("Controller objects contain valid URI that returns their state", function() {
	api_test(this.controller_list.controller[0].uri, 'GET', null, false, function(json, jqXHR) {
		ok(json.name && json.addr && json.leds, "Specific Controller state returned");
	});
});

test("Controller attributes can be modified", function() {
	var new_name = 'new name test';
	var new_brightness = this.controller_list.controller[0].brightness + 1;
	this.controller_list.controller[0].name = new_name;
	this.controller_list.controller[0].brightness = new_brightness;
	api_test(this.controller_list.controller[0].uri, 'PUT', 
					this.controller_list.controller[0], false, function(json, jqXHR) {
		ok(json.name === new_name, "Controller name changed");
		ok(json.brightness === new_brightness, "Controller brightness changes");
	});
});

test("Trying to change address of controller (should not be possible)", function() {
	var new_addr = this.controller_list.controller[0].addr + 1;
	var mod_controller = jQuery.extend({}, this.controller_list.controller[0]);
	mod_controller.addr = new_addr;
	api_test(mod_controller.uri, 'PUT', mod_controller, false, function(json, jqXHR) {
		ok(jqXHR.status >= 400 && jqXHR.status <= 499, "Address change not possible");
	});
});

test("Trying to change led count of controller (should not be possible)", function() {
	var new_led_cnt = this.controller_list.controller[0].led_cnt + 1;
	var mod_controller = jQuery.extend({}, this.controller_list.controller[0]);
	mod_controller.led_cnt = new_led_cnt;
	api_test(mod_controller.uri, 'PUT', mod_controller, false, function(json, jqXHR) {
		ok(jqXHR.status >= 400 && jqXHR.status <= 499, "led count change not possible");
	});
});

test("Trying to add a controller object (should not be possible)", function() {
	var new_addr = this.controller_list.controller[0].addr + 1;
	var mod_controller = jQuery.extend({}, this.controller_list.controller[0]);
	mod_controller.addr = new_addr;
	api_test(this.url, 'POST', mod_controller, false, function(json, jqXHR) {
		ok(jqXHR.status == 405, "POST method not supported for controller API");
	});
});

test("Trying to delete a controller  object (should not be possible)", function() {
	var controller = this.controller_list.controller[0]
	api_test(controller.uri, 'DELETE', controller, false, function(json, jqXHR) {
		ok(jqXHR.status == 405, "DELETE method not supported for controller API");
	});
});

/* ---------------------------------------------------------------------
 * ################### LED-Set API test module #########################
 * -------------------------------------------------------------------*/
module("LED-Set API", {
	setup: function() {
		var me = this;
		this.controller_url = "http://"+ location.host + "/controller";
		this.led_set_url = "http://"+ location.host + "/led_set";
		this.led_set = {
				name:'undef', 
				status:'off', 
				leds:new Array()
			};
		this.led = {
			channel:null,
			controller:null,
			current_limit:null,
			led_set:null,
			leds:null
		};
		api_test(this.controller_url, 'GET', null, false, function(json, jqXHR) {
			ok( jqXHR.status == 200, "Connected to Controller API");
			ok(json.controller.length > 0, "Controller objects available");
			me.controller_list = json;
		});
		api_test(this.led_set_url, 'GET', null, false, function(json, jqXHR) {
			ok( jqXHR.status == 200, "Connected to LED-Set API");
			// store the existing led sets
			if (json.led_set.length >= 0) {
				me.old_state = json;
			}
			// remove existing led_sets
			for (var idx = 0; idx < me.old_state.led_set.length; idx++) {
				api_test(me.old_state.led_set[idx].uri, 'DELETE', null, false, function(json, jqXHR) {
					ok( jqXHR.status == 204, "existing LED-Set removed");
				});
			}
		});
	},
	teardown: function() {
		// restore the old state
		for( var idx; idx < this.old_state.led_set.length; idx++) {
			api_test(this.led_set_url, 'POST', this.old_state.led_set[idx], false, function(json, jqXHR) {
				ok( jqXHR.status == 200, "old LED-Set restored");
			});
		}
	}
});

test("Try to create empty LED-Set", function() {
	api_test(this.led_set_url, 'POST', this.led_set, false, function(json, jqXHR) {
		ok( jqXHR.status == 409, "Empty LED-Set not created");
	});
});

test("Try to update non-existing LED-Set", function() {
	var faulty_uri = this.led_set_url + '/not_existing';
	var fake_set = this.led_set;
	fake_set.leds[0] = this.controller_list.controller[0].leds[0];
	api_test(faulty_uri , 'PUT', fake_set, false, function(json, jqXHR) {
		ok( jqXHR.status == 404, "LED set does not exist");
	});
});

test("Try to add LED-Set with non-existing LEDs", function() {
	var fake_set = this.led_set;
	fake_set.leds[0] = this.controller_list.controller[0].leds[0];
	fake_set.leds[0].channel = 25;
	api_test(this.led_set_url , 'POST', fake_set, false, function(json, jqXHR) {
		ok( jqXHR.status == 404 || jqXHR.status == 409, "LED does not exist");
	});
});

test("Try to add an incomplete LED-Set", function() {
	var fake_set = {
		name: 'fake set',
		leds: new Array()
	};
	fake_set.leds[0] = this.controller_list.controller[0].leds[0];
	api_test(this.led_set_url , 'POST', fake_set, false, function(json, jqXHR) {
		ok( jqXHR.status == 409, "Incomplete LED-Set");
	});
});

test("Add a LED-Set", function() {
	var me = this;
	var new_set = this.led_set;
	new_set.leds[0] = this.controller_list.controller[0].leds[0];
	api_test(this.led_set_url , 'POST', new_set, false, function(json, jqXHR) {
		ok( jqXHR.status == 200, "Add LED-Set");
		ok( json.name === new_set.name, "name is correct" );
		ok( json.status === new_set.status, "status is correct");
		ok( json.leds.length === new_set.leds.length, "length of LED list is correct");
		me.led_set = json;
	});
	// remove the set again
	api_test(me.led_set.uri, 'DELETE', null, false, function(json, jqXHR) {
		ok( jqXHR.status === 204, "Delete LED-Set");
	});
});

test("Delete a LED-Set", function() {
	var me = this;
	var new_set = this.led_set;
	new_set.name = 'about to be removed';
	new_set.leds[0] = this.controller_list.controller[0].leds[0];
	api_test(this.led_set_url , 'POST', new_set, false, function(json, jqXHR) {
		ok( jqXHR.status == 200, "Add LED-Set");
		me.led_set = json;
	});
	// remove the set again
	api_test(me.led_set.uri, 'DELETE', null, false, function(json, jqXHR) {
		ok( jqXHR.status === 204, "Delete LED-Set");
	});
});

test("Try to add a LED-Set with a existing Name", function() {
	var me = this;
	var new_set = this.led_set;
	new_set.leds[0] = this.controller_list.controller[0].leds[0];
	api_test(this.led_set_url , 'POST', new_set, false, function(json, jqXHR) {
		ok( jqXHR.status == 200, "Add LED-Set");
		me.led_set = json;
	});
	// try to add the same set again
	api_test(this.led_set_url , 'POST', new_set, false, function(json, jqXHR) {
		ok( jqXHR.status == 409, "Conflict with existing LED-Set");
	});
	// remove the set again
	api_test(me.led_set.uri, 'DELETE', null, false, function(json, jqXHR) {
		ok( jqXHR.status === 204, "Delete LED-Set");
	});
});

test("Modify attributes of a LED-Set", function() {
	var me = this;
	var new_set = this.led_set;
	new_set.name = 'about to be modified';
	new_set.leds[0] = this.controller_list.controller[0].leds[0];
	api_test(this.led_set_url , 'POST', new_set, false, function(json, jqXHR) {
		ok( jqXHR.status == 200, "Add LED-Set");
		me.led_set = json;
	});
	// modify the set and verify changes
	var new_name = 'modified';
	var new_status = 'on';
	me.led_set.name = new_name;
	me.led_set.status = new_status;
	api_test(me.led_set.uri, 'PUT', me.led_set, false, function(json, jqXHR) {
		ok( json.name === new_name, "Set name modified");
		ok( json.status === new_status, "Set status modified");
		ok( json.leds[0].led_set === new_name, "Contained LEDs updated with new name");
		me.led_set = json;
	});
	// remove the set again
	api_test(me.led_set.uri, 'DELETE', null, false, function(json, jqXHR) {
		ok( jqXHR.status === 204, "Delete LED-Set");
	});
});

test("Add a LED to an existing LED-Set", function() {
	var me = this;
	var new_set = this.led_set;
	new_set.name = 'led_will_be_added';
	new_set.leds[0] = this.controller_list.controller[0].leds[0];
	api_test(this.led_set_url , 'POST', new_set, false, function(json, jqXHR) {
		ok( jqXHR.status == 200, "Add LED-Set");
		me.led_set = json;
	});
	// add a LED to the set and verify changes
	me.led_set.leds[1] = this.controller_list.controller[0].leds[1];
	api_test(me.led_set.uri, 'PUT', me.led_set, false, function(json, jqXHR) {
		ok( json.leds.length === 2, "LED added to Set");
		ok( json.leds[1].led_set === new_set.name, "LED internals updated");
		me.led_set = json;
	});
	// remove the set again
	api_test(me.led_set.uri, 'DELETE', null, false, function(json, jqXHR) {
		ok( jqXHR.status === 204, "Delete LED-Set");
	});
});


test("Remove a LED from an existing LED-Set", function() {
	var me = this;
	var new_set = this.led_set;
	new_set.name = 'led_will_be_removed';
	new_set.leds[0] = this.controller_list.controller[0].leds[0];
	new_set.leds[1] = this.controller_list.controller[0].leds[1];
	api_test(this.led_set_url , 'POST', new_set, false, function(json, jqXHR) {
		ok( jqXHR.status == 200, "Add LED-Set");
		ok( json.leds.length === 2, "Set contains 2 LEDs");
		me.led_set = json;
	});
	// remove a LED from the set and verify changes
	me.led_set.leds.pop();
	api_test(me.led_set.uri, 'PUT', me.led_set, false, function(json, jqXHR) {
		ok( json.leds.length === 1, "LED removed from");
		me.led_set = json;
	});
	// remove the set again
	api_test(me.led_set.uri, 'DELETE', null, false, function(json, jqXHR) {
		ok( jqXHR.status === 204, "Delete LED-Set");
	});
});
