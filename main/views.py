from django.shortcuts import render_to_response, get_object_or_404
from django.http import StreamingHttpResponse, HttpResponseRedirect,  Http404, HttpResponse #, JsonResponse
from django.template import RequestContext, TemplateDoesNotExist
from django.core import serializers
from django.core.context_processors import csrf
from django.views.decorators.csrf import ensure_csrf_cookie, requires_csrf_token, csrf_protect
from django.contrib.auth.models import User

from main.models import Game, GameGroup, GameReport
from host.settings import MEDIA_ROOT, AJAX_PREFIX

import os, json
from django.core.servers.basehttp import FileWrapper

from django.contrib.auth.decorators import login_required

# import the logging library
import logging

# Get an instance of a logger
logger = logging.getLogger(__name__)


def index(request):
    return render_to_response('index.html', context_instance=RequestContext(request))

def teams(request):
    return render_to_response('teams.html', context_instance=RequestContext(request))

def design(request):
    return render_to_response('design.html', context_instance=RequestContext(request))

def contact(request):
    return render_to_response('contact.html', context_instance=RequestContext(request))
    
def editor(request):
    return render_to_response('editor_demo.html', context_instance=RequestContext(request))

def publicsitechanges(request):
    return render_to_response('sitechanges.html', context_instance=RequestContext(request))
    
    
# list all the games that are available to students.
@login_required
def list(request):
    if request.user.is_authenticated():
        # get all of the games the current user can see (belongs to a group that can see them).
        games = Game.objects.filter()
    else:
        games = ''
        
    return render_to_response('list.html', { 'games':games }, context_instance=RequestContext(request))


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


# play a game, defined by a yaml file.
@login_required
@csrf_protect
def play(request, game_id):
    game = get_object_or_404(Game, pk=game_id)
    print game.game_group.library_files.all()
    template_vars = { 'game': game,
                      'group_slug': game.game_group.slug,
                      'library_files': game.game_group.library_files.all(),
                      'current_user': request.user,
                      'AJAX_PREFIX':AJAX_PREFIX }
    return render_to_response('play.html', template_vars, context_instance=RequestContext(request))
 
@csrf_protect
def write_results(request, game_id):
    if not request.is_ajax():
        raise Http404
    else:
        current_user = User.objects.get(pk=request.user.id)
        print current_user
        game = Game.objects.get(pk=game_id)
        game_report = GameReport(payload=request.body, student=current_user, game=game)
        game_report.save()
        return HttpResponse(request.body, mimetype='application/json')


def custom_404(request):
    return render_to_response('error.html', { 'msg':'Could not find the requested resource.' }, context_instance=RequestContext(request))

def custom_500(request):    
    return render_to_response('error.html', { 'msg':request }, context_instance=RequestContext(request))
