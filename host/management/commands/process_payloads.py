from django.core.management.base import BaseCommand, CommandError

import os, sys, json
os.environ['DJANGO_SETTINGS_MODULE'] = 'host.settings'

from browser.models import Session, PlayedRound, Event
from main.models import Game, Round, GameReport
from django.contrib.auth.models import User

import time
import pytz
import dateutil.parser
from collections import deque

import traceback
import logging
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Parses Game data payloads and creates records of student gameplay.'

    # def add_arguments(self, parser):
    #     parser.add_argument('poll_id', nargs='+', type=int)

    def handle(self, *args, **options):
        print "running process_payloads()"
        
        report_list = GameReport.objects.all()

        for report in report_list:
            # make sure the payload isn't empty
            if report.payload != None:
        
                # check to see if the student exists
                try:
                    user = report.student
                except:
                    user, created = User.objects.get_or_create(
                        username = 'guest' + str(count),
                        defaults = {
                            'id': report.student_id,
                        }
                    )
                    if created:
                        logger.debug("Created new user #" + str(user.id))
                
                # start processing the payload (json) part.
                payload = json.loads(report.payload)
        
                # don't just skip bad payloads. yell, so somebody finds out what went wrong.
                if not (isinstance(payload, list)):
                    raise Exception("Improper payload format: %s", payload)
        
                # skip over any blank lines. should never happen.
                if (len(payload) == 0):
                    continue
            
                payload = deque(payload)
        
                # create a session if there were recorded responses.
                session_info = payload.popleft()
                session, created = Session.objects.get_or_create(
                    student = user,
                    game = report.game,
                    generated_id = session_info['session'],
                )
                if created:
                    logger.debug("Created new session #" + str(session.id))


                # if there are events and (optionally) played_rounds, keep going!
                while len(payload):
                    event_or_played_round = payload.popleft()
                    round_nbr = event_or_played_round.get('round_nbr', 0)
                    try:
                        the_round = Round.objects.get(game=report.game, nbr=round_nbr)
                    except:
                        the_round = None
            
                    if (event_or_played_round.has_key('event')):
                        # process event
                        event_type = event_or_played_round['event']
                        event, created = Event.objects.get_or_create(
                            name = event_type,
                            game = report.game,
                            round = the_round,
                            session = session,
                            timestamp = time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(event_or_played_round['timeStamp'] / 1000)),
                        )
                        if created:
                            logger.debug("Created new event #" + str(event.id))
            
                    elif (event_or_played_round.has_key('round_nbr')):
                        # if entry has a round_nbr key, but no event key, it is the results of the user's actions.
                        if not (event_or_played_round.has_key('event')):
                            # process played round
                            event, created = PlayedRound.objects.get_or_create(
                                game = report.game,
                                round = the_round,
                                session = session,
                                student = user,
                                objection = event_or_played_round.get('objection', None),
                                reason = int(float(event_or_played_round['reason'] or '0')),
                                success = (event_or_played_round['success'] == True),
                                points = the_round.points, # repetitive, but useful to have here, if point value changes.
                                timestamp = time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(event_or_played_round['timeStamp'] / 1000)),
                            )
                            if created:
                                logger.debug("Created new played round #" + str(event.id))

                    else:
                        raise Exception("unknown payload element: %s", event_or_played_round)