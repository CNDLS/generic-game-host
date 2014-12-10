from django.conf.urls import patterns, include, url

from django.contrib import admin
admin.autodiscover()

admin.site.site_title = 'CNDLS Games'
admin.site.site_header = 'CNDLS Game site administration'
admin.site.index_title = 'Database Records'

urlpatterns = patterns('',
    # Examples:
    url(r'^$', 'main.views.index', name='index'),
    url(r'^list$', 'main.views.list', name='list'),
    url(r'^read/(?P<game_id>\d+)/$', 'main.views.read', name='read'),
    url(r'^play/(?P<game_id>\d+)/$', 'main.views.play', name='play'),
    url(r'^write/(?P<game_id>\d+)/$', 'main.views.write_results', name='write'),
    url(r'^accounts/login/$', 'django.contrib.auth.views.login', name='login'),
    url(r'^accounts/logout/$', 'django.contrib.auth.views.logout', name='logout'),
	
    url(r'^browse/$', 'browser.views.index', name='browse'),
    url(r'^browse/(?P<game_id>\d+)/$', 'browser.views.report', name='report'),
    url(r'^browse/(?P<game_id>\d+)/(?P<student_netID>[a-zA-Z0-9_.-]+)/$', 'browser.views.report_for_student', name='report_for_student'),
    url(r'^summarize/(?P<game_id>\d+)/$', 'browser.views.summarize', name='summarize'),

    # Uncomment the admin/doc line below to enable admin documentation:
    # url(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    url(r'^admin/', include(admin.site.urls))
)

handler500 = 'main.views.custom_500'
handler404 = 'main.views.custom_404'
