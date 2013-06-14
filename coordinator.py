#!/usr/bin/python
from gevent.queue import Queue

import web_interface

if __name__ == '__main__':
	com_queue = Queue()
	for i in xrange (10, 17):
		com_queue.put(i)
	
	# create seperate threads for front and backend
	back = web_interface.RgbCoordinator()
	front = web_interface.Frontend(back)
	front.start();
	
	# wait for all threads to complete
	threads = []
	threads.append(front)
	for t in threads:
		t.join()
	print("exiting main thread")
