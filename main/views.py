from django.shortcuts import render_to_response, get_object_or_404
from django.http import HttpResponse, HttpResponseRedirect,  Http404
from django.template import RequestContext
from django.core import serializers
from django.core.context_processors import csrf
from django.views.decorators.csrf import ensure_csrf_cookie, requires_csrf_token, csrf_protect
from django.contrib.auth.models import User

from main.models import Case, CaseReport
from host.settings import MEDIA_ROOT, AJAX_PREFIX

import os, json
from django.core.servers.basehttp import FileWrapper

from django.contrib.auth.decorators import login_required

# list the available cases.
@login_required
def index(request):
	if request.user.is_authenticated():
		cases = Case.objects.filter(public=True) #Case.objects.all()
	else:
	    cases = ''
        
	return render_to_response('index.html', { 'cases':cases }, context_instance=RequestContext(request))


# get a game file from which to construct a game.
def read(request, case_id):
	# don't make it easy to get this from the browser.
	if not request.is_ajax():
		raise Http404
	else:
		requested_case = Case.objects.get(pk=case_id)
		the_file = MEDIA_ROOT+str(requested_case.game_spec)
		filename = os.path.basename(the_file)
		response = HttpResponse(FileWrapper(open(the_file)),
		                        content_type='application/x-yaml')
		response['Content-Length'] = os.path.getsize(the_file)    
		response['Content-Disposition'] = "attachment; filename=%s" % filename
		return response


# play the game, using a case file.
@login_required
@csrf_protect
def play(request, case_id):
   	requested_case = get_object_or_404(Case, pk=case_id)
   	return render_to_response('play.html', { 'case':requested_case, 'AJAX_PREFIX':AJAX_PREFIX }, context_instance=RequestContext(request))
   	
 
@csrf_protect
def write_results(request, case_id):
	if not request.is_ajax():
		raise Http404
	else:
		current_user = User.objects.get(pk=request.user.id)
		case = Case.objects.get(pk=case_id)
		case_report = CaseReport(payload=request.body, student=current_user, case=case)
		case_report.save()
		# payload = json.loads(payload)
		return HttpResponse(request.body, mimetype='application/json')


def custom_404(request):
	return render_to_response('error.html', { 'msg':'Could not find the requested resource.' }, context_instance=RequestContext(request))

def custom_500(request):	
	return render_to_response('error.html', { 'msg':request }, context_instance=RequestContext(request))
