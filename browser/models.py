from django.db import models
from django.core.urlresolvers import reverse
from django.contrib.auth.models import User

from main.models import Case, Round

class Session(models.Model):
	student = models.ForeignKey(User, db_column="student")
	case = models.ForeignKey(Case)
	generated_id = models.CharField(max_length=255)


# There is some redundancy here, but this will make for easy queries for tables.
class PlayedRound(models.Model):
	case = models.ForeignKey(Case)
	round = models.ForeignKey(Round)
	session = models.ForeignKey(Session)
	student = models.ForeignKey(User, db_column="student")
	objection = models.CharField(max_length=32, blank=True, null=True)
	reason = models.IntegerField()
	success = models.BooleanField()
	points = models.IntegerField()
	timestamp = models.DateTimeField(blank=True, null=True)


class Event(models.Model):
	name = models.CharField(max_length=255)
	case = models.ForeignKey(Case)
	session = models.ForeignKey(Session)
	round = models.ForeignKey(Round, null=True)
	timestamp = models.DateTimeField(blank=True, null=True)