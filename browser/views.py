from django.template import RequestContext
from django.shortcuts import render_to_response
from django.db.models import Count, Sum, Avg

import csv
from django.http import HttpResponse

from decimal import Decimal, ROUND_FLOOR

import datetime

from main.models import Case, Round, CaseReport
from browser.models import Session, PlayedRound, Event
from django.contrib.auth.models import User

from django.contrib.auth.decorators import login_required
from django.contrib.admin.views.decorators import staff_member_required
from django.db.models.base import ObjectDoesNotExist

from main.scheduled import process_payloads


# list the available cases.
@login_required
@staff_member_required
def index(request):
	# last-ditch to update reports prior to rendering
	# process_payloads()
	
	if request.user.is_authenticated():
		cases = Case.objects.filter(public=True) #Case.objects.all()
	else:
	    cases = ''
        
	return render_to_response('browser.html', { 'cases':cases, 'view_name':'browser' }, context_instance=RequestContext(request))
	

# report on students results with a case
@login_required
@staff_member_required
def report(request, case_id):
	case = Case.objects.get(pk=case_id)
	sessions = Session.objects.filter(case=case)
	plays = sessions.aggregate(Count('student', distinct=True))
	
	# we take the available points in a case, subtract the number of points a student 'earns away' from the prosecutor,
	# and then we compare the remaining prosecutor's points with the conviction score for the case.
	available_points = Round.objects.filter(case=case).aggregate(Sum('points'))['points__sum']
	
	# summary includes number of students who at least started the case, the number of sessions, 
	# the average total time spent on a game session, and the number of students who won the case.
	winning_sessions = []
	for session in sessions:
		won_rounds_in_session = PlayedRound.objects.filter(session=session, success=True, round__isnull=False).aggregate(Sum('round__points'))
		try:
			earned_points = won_rounds_in_session['round__points__sum']
		except:
			earned_points = 0
			
		if (earned_points == None):
			earned_points = 0
		earned_points_for_prosecutor = available_points - earned_points
		if (earned_points_for_prosecutor < case.conviction_score):
			winning_sessions.append(session)
	
	whole_game_results = { 'num_sessions':sessions.count, 'num_users':plays['student__count'], 'winning_sessions':len(winning_sessions) }
	
	
	rounds = Round.objects.filter(case=case).distinct()
	by_round_results = []
	for round in rounds:
		played_rounds = PlayedRound.objects.filter(round=round)
		won_rounds = PlayedRound.objects.filter(round=round, success=True)
		# I goofed on 'pass' questions -- they show up in the payload w the correct flag marked 'false' in all cases.
		# SO, we have to go back and add to won_rounds those played_rounds in which objection is 'pass',
		# and in which played_round.round.correct_answer is empty.
		correctly_passed_rounds = PlayedRound.objects.filter(round=round, objection='pass', round__correct_answer='')
		won_rounds = won_rounds | correctly_passed_rounds
		
		events = Event.objects.filter(round=round)
		
		# percent correct & ave. time spent
		ave_time_spent_on_round = 0
		cumulative_time_spent_on_round = 0
		percent_corect = 0
		if played_rounds.count() > 0:
			percent_correct = 100 * won_rounds.count() / float(played_rounds.count())
			percent_correct = Decimal(str(percent_correct)).quantize(Decimal('0.1'), rounding=ROUND_FLOOR)
			
			# for ave time, first get start of round events and pair with played_round objects that have the same session ids.
			# accumulate time_spent_on_round, and then take the ave.
			for played_round in played_rounds:
				try:
					if (played_round.session == None):
						continue
				except ObjectDoesNotExist:
					continue
					
				start_of_round_event = Event.objects.filter(name='start of round', case=case, round=round, session=played_round.session)[0]
				cumulative_time_spent_on_round += (played_round.timestamp - start_of_round_event.timestamp).seconds
		
			count_str = str(cumulative_time_spent_on_round / float(played_rounds.count()))
			ave_time_spent_on_round =  Decimal(count_str).quantize(Decimal('0.1'), rounding=ROUND_FLOOR)
			
		by_round_results.append({ 'round_nbr':round.nbr, 'points':round.points, 'ave_time':ave_time_spent_on_round, 'num_attempts':played_rounds.count, 'percent_correct': percent_correct  })
	
	return render_to_response('report.html', { 'case':case, 'view_name':'browser', 'whole_game_results':whole_game_results, 'by_round_results':by_round_results }, context_instance=RequestContext(request))
	
	
# report on INDIVIDUAL students results with a case
# started from code copied from def report(), above, on 3/13/2014 bg.
@login_required
@staff_member_required
def report_for_student(request, case_id, student_netID):
	case = Case.objects.get(pk=case_id)
	student = User.objects.get(username=student_netID)
	sessions = Session.objects.filter(case=case, student=student.id)
	
	# we take the available points in a case, subtract the number of points a student 'earns away' from the prosecutor,
	# and then we compare the remaining prosecutor's points with the conviction score for the case.
	available_points = Round.objects.filter(case=case).aggregate(Sum('points'))['points__sum']
	
	# summary includes number of students who at least started the case, the number of sessions, 
	# the average total time spent on a game session, and the number of students who won the case.
	winning_sessions = []
	for session in sessions:
		won_rounds_in_session = PlayedRound.objects.filter(session=session, success=True, round__isnull=False).aggregate(Sum('round__points'))
		try:
			earned_points = won_rounds_in_session['round__points__sum']
		except:
			earned_points = 0
			
		if (earned_points == None):
			earned_points = 0
		earned_points_for_prosecutor = available_points - earned_points
		if (earned_points_for_prosecutor < case.conviction_score):
			winning_sessions.append(session)
	
	whole_game_results = { 'num_sessions':sessions.count, 'student_id':str(student.id), 'winning_sessions':len(winning_sessions) }
	
	
	rounds = Round.objects.filter(case=case).distinct()
	by_round_results = []
	for round in rounds:
		played_rounds = PlayedRound.objects.filter(round=round, student=student)
		won_rounds = PlayedRound.objects.filter(round=round, success=True)
		# I goofed on 'pass' questions -- they show up in the payload w the correct flag marked 'false' in all cases.
		# SO, we have to go back and add to won_rounds those played_rounds in which objection is 'pass',
		# and in which played_round.round.correct_answer is empty.
		correctly_passed_rounds = PlayedRound.objects.filter(round=round, objection='pass', round__correct_answer='')
		won_rounds = won_rounds | correctly_passed_rounds
		
		events = Event.objects.filter(round=round)
		
		# percent correct & ave. time spent
		ave_time_spent_on_round = 0
		cumulative_time_spent_on_round = 0
		percent_corect = 0
		if played_rounds.count() > 0:
			percent_correct = 100 * won_rounds.count() / float(played_rounds.count())
			percent_correct = Decimal(str(percent_correct)).quantize(Decimal('0.1'), rounding=ROUND_FLOOR)
			
			# for ave time, first get start of round events and pair with played_round objects that have the same session ids.
			# accumulate time_spent_on_round, and then take the ave.
			for played_round in played_rounds:
				try:
					if (played_round.session == None):
						continue
				except ObjectDoesNotExist:
					continue
					
				start_of_round_event = Event.objects.filter(name='start of round', case=case, round=round, session=played_round.session)[0]
				cumulative_time_spent_on_round += (played_round.timestamp - start_of_round_event.timestamp).seconds
		
			count_str = str(cumulative_time_spent_on_round / float(played_rounds.count()))
			ave_time_spent_on_round =  Decimal(count_str).quantize(Decimal('0.1'), rounding=ROUND_FLOOR)
			
		by_round_results.append({ 'round_nbr':round.nbr, 'points':round.points, 'ave_time':ave_time_spent_on_round, 'num_attempts':played_rounds.count, 'percent_correct': percent_correct  })
	
	return render_to_response('report.html', { 'case':case, 'view_name':'browser', 'whole_game_results':whole_game_results, 'by_round_results':by_round_results }, context_instance=RequestContext(request))
	
	
	
# summarize each student's results with a case
# one row per student, suitable for export to excel via CSV file.
# started from code copied from def report(), above, on 3/13/2014 bg.
@login_required
@staff_member_required
def summarize(request, case_id):
	case = Case.objects.get(pk=case_id)
	students = User.objects.all()
	
	# Create the HttpResponse object with the appropriate CSV header.
	response = HttpResponse(content_type='text/csv')
	response['Content-Disposition'] = 'attachment; filename="case_' + str(case.id) + '_summary.csv"'
	
	writer = csv.writer(response)
	# write column headers
	writer.writerow(['NetID', 'Num Sessions', 'Num Wins', 'Best Score', 'Best Session timestamp'])
	
	# we take the available points in a case, subtract the number of points a student 'earns away' from the prosecutor,
	# and then we compare the remaining prosecutor's points with the conviction score for the case.
	available_points = Round.objects.filter(case=case).aggregate(Sum('points'))['points__sum']
	
	for student in students:
		sessions = Session.objects.filter(case=case, student=student)
		
		num_wins = 0
		best_score = 0
		best_session_start = Event()
		for session in sessions:
			won_rounds_in_session = PlayedRound.objects.filter(session=session, success=True, round__isnull=False).aggregate(Sum('round__points'))
			try:
				earned_points = won_rounds_in_session['round__points__sum']
			except:
				earned_points = 0
		
			if (earned_points == None):
				earned_points = 0
			earned_points_for_prosecutor = available_points - earned_points
		
			if (earned_points_for_prosecutor < case.conviction_score):
				num_wins += 1
			
			# record the session when the user got their highest score 
			# in case they duplicate it later, use the first time
			if ( (earned_points_for_prosecutor < best_score) or (best_score == 0) ):
				best_score = earned_points_for_prosecutor
				best_session_start = Event.objects.get(name="start of game", session=session)
				
		writer.writerow([student.username, len(sessions), num_wins, best_score, best_session_start.timestamp])

	return response