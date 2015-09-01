from django.db import models
from django.db.models import signals
# from validatedfile.fields import ValidatedFileField
from django.contrib.auth.models import User
from django.utils.text import slugify

# Receive the pre_delete signal and delete the file associated with the model instance.
from django.db.models.signals import pre_delete
from django.dispatch.dispatcher import receiver

import sys
import yaml
import os
import time
from uuid import uuid1, uuid4

from taggit.managers import TaggableManager
from host.settings import MEDIA_ROOT

from validatedfile.fields import ValidatedFileField
validatedfile_rules = [(
    [ValidatedFileField],
    [],
    {
        "content_types": ["content_types", {"default": []}],
        "max_upload_size": ["max_upload_size", {"default": 0}],
        "mime_lookup_length": ["mime_lookup_length", {"default": 4096}],
    }
)]

from south.modelsinspector import add_introspection_rules
add_introspection_rules(validatedfile_rules, ["^validatedfile\.fields\.ValidatedFileField"])



def path_for_game_file():
    def path_generator(instance, filename):
        ext = filename.split('.')[-1]
        basename = filename.split('.')[0]
        # set path.
        if instance.game_group:
            library_dir = slugify(instance.game_group.name) if instance.game_group else "ungrouped"
            path = "uploads/{library_dir}/games/".format(library_dir=library_dir)
        else:
            path = "uploads/unclaimed/" # dump problematic files where we can see them.
            
        # since this is going into the group directory, along with Library files, make sure the filename is unique.
        filename = "{}_{}.{}".format(basename, int(time.time()), ext)
        
        # return the whole path to the file
        return os.path.join(path, filename)
    return path_generator
    
    
class Game(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    game_group = models.ForeignKey("GameGroup")
    game_spec = ValidatedFileField(
                        null = True,
                        blank = True,
                        upload_to = path_for_game_file(),
                        max_upload_size = 204800, # 200KB
                        content_types = ['application/x-yaml','text/yaml','text/plain','text/plain; charset=us-ascii'])
    tags = TaggableManager(blank=True)
    
    def slug(self):
        return slugify(self.name)
        
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

    
@receiver(pre_delete, sender=Game)
def game_delete(sender, instance, **kwargs):
    # Pass false so FileField doesn't save the model.
    instance.game_spec.delete(False)



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


class GameGroup(models.Model):
    name = models.CharField(max_length=255)
    games = models.ManyToManyField(Game, blank=True, null=True)
    users = models.ManyToManyField(User, blank=True, null=True, through="Membership")
    library_files = models.ManyToManyField("LibraryFile", blank=True, null=True)
    
    def slug(self):
        return slugify(self.name)
        
    def __unicode__(self):
        return self.name


class Role(models.Model):
    name = models.CharField(max_length=64)
    
    def __unicode__(self):
        return self.name


class Membership(models.Model):
    user = models.ForeignKey(User)
    game_group = models.ForeignKey(GameGroup)
    role = models.ForeignKey(Role)
    
    def __unicode__(self):
        return "{}:{}".format(self.game_group.name, self.role.name)


def path_for_media_type():
    def path_generator(instance, filename):
        ext = filename.split('.')[-1]
        # set path.
        if instance.game_group:
            library_dir = slugify(instance.game_group.name) if instance.game_group else "ungrouped"
            path = "uploads/{library_dir}/custom_{media_type}/".format(library_dir=library_dir, media_type=instance.media_type)
        else:
            path = "uploads/unclaimed/" # dump problematic files where we can see them.
            
        # return the whole path to the file
        return os.path.join(path, filename)
    return path_generator


class LibraryFile(models.Model):
    MEDIA_CHOICES = (
        ('js', 'js'),
    )
    media_type = models.CharField(max_length=64, choices=MEDIA_CHOICES)
    description = models.TextField(blank=True, null=True)
    game_group = models.ForeignKey(GameGroup)
    file = models.FileField(
                        null = True,
                        blank = True,
                        upload_to = path_for_media_type())
        
    def __unicode__(self):
        return self.file.name


@receiver(pre_delete, sender=LibraryFile)
def library_file_delete(sender, instance, **kwargs):
    # Pass false so FileField doesn't save the model.
    instance.file.delete(False)
