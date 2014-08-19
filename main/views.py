from django.shortcuts import render_to_response, get_object_or_404
from django.http import StreamingHttpResponse, HttpResponseRedirect,  Http404
from django.template import RequestContext, TemplateDoesNotExist
from django.core import serializers
from django.core.context_processors import csrf
from django.views.decorators.csrf import ensure_csrf_cookie, requires_csrf_token, csrf_protect
from django.contrib.auth.models import User

from main.models import Game, GameReport
from host.settings import MEDIA_ROOT, AJAX_PREFIX

import os, json
from django.core.servers.basehttp import FileWrapper

from django.contrib.auth.decorators import login_required

# list the available .
@login_required
def index(request):
	if request.user.is_authenticated():
		games = Game.objects.filter(public=True) #Game.objects.all()
	else:
	    games = ''
        
	return render_to_response('index.html', { 'games':games }, context_instance=RequestContext(request))


# get a game file from which to construct a game.
def read(request, game_id):
	# don't make it easy to get this from the browser.
	if not request.is_ajax():
		raise Http404
	else:
		requested_game = Game.objects.get(pk=game_id)
		the_file = MEDIA_ROOT+str(requested_game.game_spec)
		filename = os.path.basename(the_file)
		response = StreamingHttpResponse(FileWrapper(open(the_file)),
		                        content_type='application/x-yaml')
		response['Content-Length'] = os.path.getsize(the_file)    
		response['Content-Disposition'] = "attachment; filename=%s" % filename
		return response


# play the game, using a case file.
@login_required
@csrf_protect
def play(request, game_id):
   	requested_game = get_object_or_404(Game, pk=game_id)
	try:
	   	return render_to_response('play.html', { 'game':requested_game, 'AJAX_PREFIX':AJAX_PREFIX }, context_instance=RequestContext(request))
	except TemplateDoesNotExist:
   		return render_to_response('example-play.html', { 'game':requested_game, 'AJAX_PREFIX':AJAX_PREFIX }, context_instance=RequestContext(request))
 
@csrf_protect
def write_results(request, game_id):
	if not request.is_ajax():
		raise Http404
	else:
		current_user = User.objects.get(pk=request.user.id)
		case = Game.objects.get(pk=game_id)
		game_report = GameReport(payload=request.body, student=current_user, case=case)
		game_report.save()
		# payload = json.loads(payload)
		return StreamingHttpResponse(request.body, mimetype='application/json')


def custom_404(request):
	return render_to_response('error.html', { 'msg':'Could not find the requested resource.' }, context_instance=RequestContext(request))

def custom_500(request):	
	return render_to_response('error.html', { 'msg':request }, context_instance=RequestContext(request))
