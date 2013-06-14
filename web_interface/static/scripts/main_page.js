/* define the nfy_widget class */

/* Notify Widget constructor  */
function NfyWidget(jQueryElement) {
	this.jQueryElement = jQueryElement;
	/* copy a pointer to the new object into a local variable. This variable
	 * will be used within the functions for the event hooks, and allows them
	 * to locate the object later when they are called */
	var self = this;
	
	/* use jQuery to register the EventHandlers in a browser compatible fashion */
	//TODO: check parameter passed to constructor
	$(jQueryElement).on('click', '.ntfy_menu img', function(event) {
		self.handleEvent(event);
	});
	
	/* new notification Event */
	$(jQueryElement).on('newNotification', '.ntfy_notifications', function(event) {
		self.handleEvent(event);
	});
	
	/* add an icon to the widget topbar */
	var notification_menu = $('<div>')
		.addClass('ntfy_menu')
		.appendTo(jQueryElement);
	$(notification_menu).prepend('<img id="ntfy_logo" src="static/images/notifications.png" width="32" />');
	
	/* add the container for notification items */
	var notification_container = $('<div>')
		.addClass('ntfy_notifications')
		.appendTo(jQueryElement);
	
	/* initialize the FSM */
	this.currentState = this.initialState;
}

/* Notify Widget class prototype */
NfyWidget.prototype = {
	currentState: null,
	currentTimer: null,
	currentTicker: null,
	
	displayTime: 5,
	
	/* constant for initial state of the FSM */
	initialState: 'Inactive',
	
	/* start a timer, register "handleEvent" callback function for timeout events */
	startTimer: function(timeout) {
		var self = this;
		this.currentTimer = setTimeout( 
			function() { self.handleEvent( {type: 'timeout'}); },
			timeout
			);
	},
	/* cancel the timer if it's running */
	cancelTimer: function() {
		if(this.currentTimer) clearTimeout(this.currentTimer);
		this.currentTimer = null;
	},
	
	/* start a ticker, register "handleEvent" callback function for tick events */
	startTicker: function(interval) {
		var self = this;
		this.currentTicker = setInterval(
			function() { self.handleEvent({type: 'tick'}); },
			interval
			); 
	},
	/* cancel the ticker if it's running */
	cancelTicker: function() {
		if(this.currentTicker) clearInterval(this.currentTicker);
		this.currentTicker = null;
	},
	
	/* the handleEvent function for reacting to events based on the state table */
	handleEvent: function(event) {
		// get the transition function triggered by the current event
		var transFunction = this.transitionFunctions[this.currentState][event.type];
		if(!transFunction) transFunction = this.unexpectedEvent;
		var nextState = transFunction.call(this, event);
		if(!nextState) nextState = this.currentState;
		if(!this.transitionFunctions[nextState]) nextState = this.undefinedState(event, nextState);
		this.currentState = nextState;
	},
	
	/* return to a defined state if there's no matching event in the state table */
	unexpectedEvent: function(event, state) {
		console.log("unexpected event " + event.type + " in state " + this.currentState);
		return this.initialState;
	},

	/* fail gracefully if the FSM ends up in an undefined State and inform the user */
	undefinedState: function(event, state) {
		this.cancelTimer;
		this.cancelTicker;
		alert("nfy Widget transition to undefined state " + state + " from state " + this.currentState + " by event " + event.type);
		return this.initialState;
	},
	
	/* used to trigger a certain transition manually
	 * can be used, if multiple entries in the state table contain the same transition
	 * actions */
	doTransition: function(anotherState, anotherEvent, event) {
		return this.transitionFunctions[anotherState][anotherEvent].call(this, event);
	},
	
	/* define the state table as a two dimensional associative array, 
	 * containing annonymous functions for each state transition */
	transitionFunctions: {
		Inactive: {
			// show the notification for x seconds, than fade out
			newNotification: function(event) {
				this.startTimer(this.displayTime * 1000);
				$('.ntfy_notifications')
					.children()
					.first()
					.slideDown();
				return 'Display';
			},
			// show the latest notification until user request close
			click: function(event) {
				$('.ntfy_notifications')
					.children()
					.first()
					.slideDown();
				return 'Display';
			}
		},
		Display: {
			// if a timer is running, reset it to extend the display period
			newNotification: function(event) {
				if(this.currentTimer) this.cancelTimer();
				this.doTransition('Inactive', event.type, event);
			},
			click: function(event) {
				this.cancelTimer();
				this.doTransition('Display', event.type, { type: 'timeout' });
				console.log("State: " + this.currentState + " event: "+event.type);
				return 'Inactive';
			},
			timeout: function(event) {
				//TODO: fade out notification(s), mark as seen
				$('.ntfy_notifications').children().fadeOut().attr('seen', true).slideUp();
				console.log("State: " + this.currentState + " event: "+event.type);
				return 'Inactive';
			}
		}
	},
}

/* behavior of the notification Widget */
$(document).ready(function() {
				
				// hide the HTML templates by default
				$('#templates').hide();
				
				// event handler for the "remove notification" button
				$('#notify_widget').on('click', '.removeButton', function() {
					$(this).parent().remove();
					// triger the event handler that handles the notification widget
					$('#notify_widget .ntfy_notifications').trigger('newNotification');
					return false;
				});

				// ntfy: open a SSE connection to the server, and react to received msgs
				see = new EventSource(SCRIPT_ROOT + '/_counter');
				see.onmessage = function(message) {
					// create a new div for the notification
					var notification = $('<div>')
						.addClass('notification_item')
						.prependTo('#notify_widget .ntfy_notifications')
						.hide();
					// clone the notification item template and append it to the div
					$('#templates .notification')
						.children()
						.clone()
						.appendTo(notification);
					// set the text of the new notification
					$('#notify_widget .notification_item span')
						.first()
						.text(message.data)
						.attr("seen", false);
					// triger the event handler that handles the notification widget
					$('#notify_widget .ntfy_notifications').trigger('newNotification');
				}
				
				// ntfy: event handler triggered when new notifications are received
				$('#notify_widget').on('newNotification', '.ntfy_notifications', function(event) {
					// hide all entries except for the first 5 entries
					//$(this).children().hide();
					//$(this).children().slice(0, 5).show();
			
					// update the menu bar
					$('#notify_widget .ntfy_menu .ntfy_count')
						.text('total ' + $(this).children().size() +' notifications');
				});
				
				// ntfy: event handler for clear button
				$('#notify_widget').on('click', '.ntfy_clear', function(event) {
					$('#notify_widget .ntfy_notifications')
						.children()
						.remove();
					// triger the event handler that handles the notification widget
					$('#notify_widget .ntfy_notifications').trigger('newNotification');
				});
				
				// ntfy: event handler for show all button
				$('#notify_widget').on('click', '.ntfy_show_all', function(event) {
					$('#notify_widget .ntfy_notifications')
						.children()
						.show();
					$(this)
						.text('back')
						.addClass('ntfy_back wrappedElement')
						.removeClass('ntfy_show_all');
				});
				
				// ntfy: event handler for back button (inverse of show all) button
				$('#notify_widget').on('click', '.ntfy_back', function(event) {
					// triger the event handler that handles the notification widget
					$('#notify_widget .ntfy_notifications').trigger('newNotification');
					$(this)
						.text('Show all')
						.addClass('ntfy_show_all')
						.removeClass('ntfy_back wrappedElement');
				});
				
				// event handler for AJAX request to server
				$('#notify_widget .update').click(function(event) {
					var a = $('#input input[name="a"]').val();
					var b = $('#input input[name="b"]').val();
					var op = $('#input select :selected').attr('value');
					$.getJSON(SCRIPT_ROOT + '/_m_operation', 
						{a:a, b:b, op:op},
						function(data) {
							// create a new div for the notification
							var notification = $('<div>')
								.addClass('notification_item')
								.appendTo('#notify_item .ntfy_notifications');
							// clone the notification item template and append it to the div
							$('#templates .notification')
								.children()
								.clone()
								.appendTo(notification);
							// set the text of the new notification
							$('#notify_widget .ntfy_notifications .notification_item span').last().text('Result = ' + data.result)
						});
				});
				
});
