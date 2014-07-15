from django_cron import CronJobBase, Schedule

# This is a function I wrote to check a feedback email address and add it to our database. Replace with your own imports
from scheduled import process_payloads

class ProcessUserData(CronJobBase):
	RUN_AT_TIMES = ['3:32']

	schedule = Schedule(run_at_times=RUN_AT_TIMES)
	code = 'main.process_payloads_cron_job'    # a unique code

	def do(self):
		# This will be executed once per day at the specified time.
		process_payloads()