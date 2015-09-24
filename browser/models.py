from django.db import models
from django.core.urlresolvers import reverse
from django.contrib.auth.models import User

from main.models import Game

class Session(models.Model):
    player = models.ForeignKey(User, db_column="player")
    game = models.ForeignKey(Game)
    generated_id = models.CharField(max_length=255)


class Event(models.Model):
    name = models.CharField(max_length=255)
    game = models.ForeignKey(Game)
    round_nbr = models.IntegerField()
    round_id = models.CharField(max_length=255)
    session = models.ForeignKey(Session)
    data = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(blank=True, null=True)


# There is some redundancy here, but this will make for easy queries for tables.
class PlayedRound(Event):
    success = models.BooleanField(default=False)
    points = models.IntegerField()