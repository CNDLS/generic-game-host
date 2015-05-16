from django.db import models
from django.db.models import signals
# from validatedfile.fields import ValidatedFileField
from django.contrib.auth.models import User

import sys
import yaml
from host.settings import MEDIA_ROOT
from django.core.servers.basehttp import FileWrapper


class GameType(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True,null=True)
    template = models.FileField(
                        null = True,
                        blank = True,
                        upload_to = 'uploads/custom_templates/')
    css = models.FileField(
                        null = True,
                        blank = True,
                        upload_to = 'uploads/custom_css/')
    js = models.FileField(
                        null = True,
                        blank = True,
                        upload_to = 'uploads/custom_js/')
    score_accrues_to_computer = models.BooleanField(default=False)
        
    def __unicode__(self):
        return self.name

    
class Game(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True,null=True)
    game_type = models.ForeignKey(GameType, unique=False)
    public = models.BooleanField(default=False)
    parsed = models.BooleanField(default=False)
    winning_score = models.IntegerField(default=0)
    score_accrues_to_computer = models.BooleanField(default=False)
    game_spec = models.FileField(
                        null = True,
                        blank = True,
                        upload_to = 'uploads/games/')
                        # max_upload_size = 102400, # 100KB
                        # content_types = ['application/x-yaml','text/yaml','text/plain','text/plain; charset=us-ascii'])
        
    def __unicode__(self):
        return self.name
        

    def save(self, *args, **kwargs):
        # create Round objects as nec. set a 'parsed' flag to true when done.
        super(Game, self).save(*args, **kwargs)
        
        game_yaml_file_path = MEDIA_ROOT + str(self.game_spec)
        game_yaml_file = None
        try:
            game_yaml_file = open(game_yaml_file_path, 'r')
            game_yaml = yaml.load(game_yaml_file)

            # for a first stab at game YAML validation, 
            # we try to create a Round object for each Round in the uploaded file.
            # if this fails, we pass back a validation error.
            rounds = game_yaml.get('rounds')
            for i, round in enumerate(rounds):
                rnd, created = Round.objects.get_or_create(game=self, nbr=(i+1), points=value)
                if created:
                    rnd.save()

            # if we've gotten this far, note it in the db.
            self.parsed = True
            super(Game, self).save(*args, **kwargs)

        except:
            e = sys.exc_info()[0]
            print( "Error: %s" % e )
            
        finally:
            if (game_yaml_file):
                game_yaml_file.close()


class Round(models.Model):
    game = models.ForeignKey(Game)
    nbr = models.IntegerField()
    correct_answer = models.CharField(max_length=32)
    points = models.IntegerField()


class Struct:
    def __init__(self, **entries):
        self.__dict__.update(entries)


class GameReport(models.Model):
    payload = models.TextField(blank=True,null=True)
    student = models.ForeignKey(User, unique=False)
    game = models.ForeignKey(Game, unique=False)
    created_on = models.DateTimeField(auto_now_add=True)

    def _decode_payload(self):
        args = json.loads(self.payload)
        s = Struct(**args)
        return s
    decoded_payload = property(_decode_payload)
