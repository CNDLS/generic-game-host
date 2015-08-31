from django.contrib import admin
from main.models import GameGroup, Game, Membership, Role, LibraryFile

admin.site.register(GameGroup)
admin.site.register(Game)
admin.site.register(Membership)
admin.site.register(Role)
admin.site.register(LibraryFile)