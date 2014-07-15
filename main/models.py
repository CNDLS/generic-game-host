from django.db import models
from django.db.models import signals
from validatedfile.fields import ValidatedFileField
from django.contrib.auth.models import User

import sys
import yaml
from host.settings import MEDIA_ROOT
from django.core.servers.basehttp import FileWrapper


class Case(models.Model):
	name = models.CharField(max_length=255)
	description = models.TextField(blank=True,null=True)
	public = models.BooleanField()
	parsed = models.BooleanField()
	conviction_score = models.IntegerField()
	game_spec = ValidatedFileField(
						null = True,
						blank = True,
						upload_to = 'uploads',
						max_upload_size = 102400, # 100KB
						content_types = ['application/x-yaml','text/yaml','text/plain','text/plain; charset=us-ascii'])
		
	def __unicode__(self):
		return self.name
		

	def save(self, *args, **kwargs):
		# create Round objects as nec. set a 'parsed' flag to true when done.
		case_yaml_file_path = MEDIA_ROOT + str(self.game_spec)
		try:
			case_yaml_file = open(case_yaml_file_path, 'r')
			case_yaml = yaml.load(case_yaml_file)

			self.conviction_score = case_yaml.get('conviction_score')
			super(Case, self).save(*args, **kwargs)

			rounds = case_yaml.get('rounds')

			for i, round in enumerate(rounds):
				evidence = round.get('evidence')
				valid_objection_rules = evidence.get('valid_objection_rules')
				if (valid_objection_rules == []):
					valid_objection_rules_str = ""
				else:
					valid_objection_rules_str = ','.join(str(x) for x in valid_objection_rules.keys())
				value = evidence.get('value')
				rnd, created = Round.objects.get_or_create(case=self, nbr=(i+1), correct_answer=valid_objection_rules_str, points=value)
				if created:
					rnd.save()

			# if we've gotten this far, note it in the db.
			self.parsed = True
			super(Case, self).save(*args, **kwargs)

		except:
			e = sys.exc_info()[0]
			print( "Error: %s" % e )
			
		finally:
			if (case_yaml_file):
				case_yaml_file.close()


class Round(models.Model):
	case = models.ForeignKey(Case)
	nbr = models.IntegerField()
	correct_answer = models.CharField(max_length=32)
	points = models.IntegerField()

class Struct:
	def __init__(self, **entries):
		self.__dict__.update(entries)


class CaseReport(models.Model):
	payload = models.TextField(blank=True,null=True)
	student = models.ForeignKey(User, unique=False)
	case = models.ForeignKey(Case, unique=False)
	created_on = models.DateTimeField(auto_now_add=True)

	def _decode_payload(self):
		args = json.loads(self.payload)
		s = Struct(**args)
		return s
	decoded_payload = property(_decode_payload)
