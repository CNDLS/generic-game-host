from django.contrib import admin
from main.models import GameGroup, Game, Membership, LibraryFile

admin.site.register(GameGroup)
admin.site.register(Game)
admin.site.register(Membership)
admin.site.register(LibraryFile)