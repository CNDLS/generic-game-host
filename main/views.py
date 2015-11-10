from django.shortcuts import render_to_response, get_object_or_404
from django.http import StreamingHttpResponse, HttpResponseRedirect,  Http404, HttpResponse #, JsonResponse
from django.template import RequestContext, TemplateDoesNotExist
from django.core import serializers
from django.core.context_processors import csrf
from django.views.decorators.csrf import ensure_csrf_cookie, requires_csrf_token, csrf_protect
from django.contrib.auth.models import User

from main.models import Game, GameReport
from main.models import GameGroup, Membership, Role
from host.settings import MEDIA_ROOT, AJAX_PREFIX, ANONYMOUS_USER_ID

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
    
def publicsitechanges(request):
    return render_to_response('sitechanges.html', context_instance=RequestContext(request))
    
    
def recorderWorker(request):
    return render_to_response('recorderWorker.js', context_instance=RequestContext(request))
    
def getGamesByGroupMembership():
    Game.objects.filter()
    
    
# list all the games that are available to the current user.
def list(request):
    user_id = request.user.id if request.user.is_authenticated() else -1
    if request.user.is_authenticated() and request.user.is_superuser:
        games = Game.objects.all()
    else:
        user_memberships = Membership.objects.filter(user=user_id)
        games = Game.objects.filter(game_group__in=user_memberships.prefetch_related('game_group'))
    
        for game in games:
            # temporarily set a role value on the game object, to control edit access in the template.
            game.role = str(user_memberships.get(game_group=game.game_group).role)
    
    return render_to_response('list.html', { 'games': games,
                                             'current_user': request.user,
                                            }, context_instance=RequestContext(request))


def edit(request, game_id):
    game = get_object_or_404(Game, pk=game_id)
    template_vars = { 'game': game,
                      'group_slug': game.game_group.slug,
                      'library_files': game.game_group.library_files.all(),
                      'AJAX_PREFIX': AJAX_PREFIX,
                      'USERNAME': request.user.get_full_name }
    return render_to_response('editor_demo.html', template_vars, context_instance=RequestContext(request))

def editormock(request):
    return render_to_response('editor_mock.html', context_instance=RequestContext(request))
    
def playermock(request):
    return render_to_response('flowplayer/index.html', context_instance=RequestContext(request))
    
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
@csrf_protect
def play(request, game_id):
    game = get_object_or_404(Game, pk=game_id)
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
        current_user = User.objects.get(pk=(request.user.id or ANONYMOUS_USER_ID))
        game = Game.objects.get(pk=game_id)
        game_report = GameReport(payload=request.body, student=current_user, game=game)
        game_report.save()
        return HttpResponse(request.body, mimetype='application/json')


def custom_404(request):
    return render_to_response('error.html', { 'msg':'Could not find the requested resource.' }, context_instance=RequestContext(request))

def custom_500(request):    
    return render_to_response('error.html', { 'msg':request }, context_instance=RequestContext(request))
