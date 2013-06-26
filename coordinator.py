#!/usr/bin/python
import web_interface
import i2c_raspberry

if __name__ == '__main__':
	# create seperate threads for front and backend
	back = i2c_raspberry.RgbCoordinator()
	front = web_interface.Frontend(back)
	front.start();
	
	# wait for all threads to complete
	threads = []
	threads.append(front)
	for t in threads:
		t.join()
	print("exiting main thread")
