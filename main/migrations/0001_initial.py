# -*- coding: utf-8 -*-
from south.utils import datetime_utils as datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Adding model 'Game'
        db.create_table(u'main_game', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('name', self.gf('django.db.models.fields.CharField')(max_length=255)),
            ('description', self.gf('django.db.models.fields.TextField')(null=True, blank=True)),
            ('game_spec', self.gf('validatedfile.fields.ValidatedFileField')(content_types=['application/x-yaml', 'text/yaml', 'text/plain', 'text/plain; charset=us-ascii'], max_upload_size=204800, null=True, max_length=100, blank=True)),
        ))
        db.send_create_signal(u'main', ['Game'])

        # Adding model 'Round'
        db.create_table(u'main_round', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('game', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['main.Game'])),
            ('nbr', self.gf('django.db.models.fields.IntegerField')()),
            ('correct_answer', self.gf('django.db.models.fields.CharField')(max_length=32)),
            ('points', self.gf('django.db.models.fields.IntegerField')()),
        ))
        db.send_create_signal(u'main', ['Round'])

        # Adding model 'GameReport'
        db.create_table(u'main_gamereport', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('payload', self.gf('django.db.models.fields.TextField')(null=True, blank=True)),
            ('student', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['auth.User'])),
            ('game', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['main.Game'])),
            ('created_on', self.gf('django.db.models.fields.DateTimeField')(auto_now_add=True, blank=True)),
        ))
        db.send_create_signal(u'main', ['GameReport'])

        # Adding model 'GameGroup'
        db.create_table(u'main_gamegroup', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('name', self.gf('django.db.models.fields.CharField')(max_length=255)),
        ))
        db.send_create_signal(u'main', ['GameGroup'])

        # Adding M2M table for field games on 'GameGroup'
        m2m_table_name = db.shorten_name(u'main_gamegroup_games')
        db.create_table(m2m_table_name, (
            ('id', models.AutoField(verbose_name='ID', primary_key=True, auto_created=True)),
            ('gamegroup', models.ForeignKey(orm[u'main.gamegroup'], null=False)),
            ('game', models.ForeignKey(orm[u'main.game'], null=False))
        ))
        db.create_unique(m2m_table_name, ['gamegroup_id', 'game_id'])

        # Adding model 'Membership'
        db.create_table(u'main_membership', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('user', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['auth.User'])),
            ('game_group', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['main.GameGroup'])),
            ('role', self.gf('django.db.models.fields.CharField')(max_length=64)),
        ))
        db.send_create_signal(u'main', ['Membership'])

        # Adding model 'LibraryFile'
        db.create_table(u'main_libraryfile', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('media_type', self.gf('django.db.models.fields.CharField')(max_length=64)),
            ('description', self.gf('django.db.models.fields.TextField')(null=True, blank=True)),
            ('game_group', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['main.GameGroup'])),
            ('file', self.gf('django.db.models.fields.files.FileField')(max_length=100, null=True, blank=True)),
        ))
        db.send_create_signal(u'main', ['LibraryFile'])


    def backwards(self, orm):
        # Deleting model 'Game'
        db.delete_table(u'main_game')

        # Deleting model 'Round'
        db.delete_table(u'main_round')

        # Deleting model 'GameReport'
        db.delete_table(u'main_gamereport')

        # Deleting model 'GameGroup'
        db.delete_table(u'main_gamegroup')

        # Removing M2M table for field games on 'GameGroup'
        db.delete_table(db.shorten_name(u'main_gamegroup_games'))

        # Deleting model 'Membership'
        db.delete_table(u'main_membership')

        # Deleting model 'LibraryFile'
        db.delete_table(u'main_libraryfile')


    models = {
        u'auth.group': {
            'Meta': {'object_name': 'Group'},
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '80'}),
            'permissions': ('django.db.models.fields.related.ManyToManyField', [], {'to': u"orm['auth.Permission']", 'symmetrical': 'False', 'blank': 'True'})
        },
        u'auth.permission': {
            'Meta': {'ordering': "(u'content_type__app_label', u'content_type__model', u'codename')", 'unique_together': "((u'content_type', u'codename'),)", 'object_name': 'Permission'},
            'codename': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'content_type': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['contenttypes.ContentType']"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50'})
        },
        u'auth.user': {
            'Meta': {'object_name': 'User'},
            'date_joined': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75', 'blank': 'True'}),
            'first_name': ('django.db.models.fields.CharField', [], {'max_length': '30', 'blank': 'True'}),
            'groups': ('django.db.models.fields.related.ManyToManyField', [], {'symmetrical': 'False', 'related_name': "u'user_set'", 'blank': 'True', 'to': u"orm['auth.Group']"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'is_staff': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'is_superuser': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'last_login': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'last_name': ('django.db.models.fields.CharField', [], {'max_length': '30', 'blank': 'True'}),
            'password': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'user_permissions': ('django.db.models.fields.related.ManyToManyField', [], {'symmetrical': 'False', 'related_name': "u'user_set'", 'blank': 'True', 'to': u"orm['auth.Permission']"}),
            'username': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '30'})
        },
        u'contenttypes.contenttype': {
            'Meta': {'ordering': "('name',)", 'unique_together': "(('app_label', 'model'),)", 'object_name': 'ContentType', 'db_table': "'django_content_type'"},
            'app_label': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'model': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '100'})
        },
        u'main.game': {
            'Meta': {'object_name': 'Game'},
            'description': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'game_spec': ('validatedfile.fields.ValidatedFileField', [], {'content_types': "['application/x-yaml', 'text/yaml', 'text/plain', 'text/plain; charset=us-ascii']", 'max_upload_size': '204800', 'null': 'True', 'max_length': '100', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '255'})
        },
        u'main.gamegroup': {
            'Meta': {'object_name': 'GameGroup'},
            'games': ('django.db.models.fields.related.ManyToManyField', [], {'symmetrical': 'False', 'to': u"orm['main.Game']", 'null': 'True', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '255'}),
            'users': ('django.db.models.fields.related.ManyToManyField', [], {'symmetrical': 'False', 'to': u"orm['auth.User']", 'null': 'True', 'through': u"orm['main.Membership']", 'blank': 'True'})
        },
        u'main.gamereport': {
            'Meta': {'object_name': 'GameReport'},
            'created_on': ('django.db.models.fields.DateTimeField', [], {'auto_now_add': 'True', 'blank': 'True'}),
            'game': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['main.Game']"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'payload': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'student': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['auth.User']"})
        },
        u'main.libraryfile': {
            'Meta': {'object_name': 'LibraryFile'},
            'description': ('django.db.models.fields.TextField', [], {'null': 'True', 'blank': 'True'}),
            'file': ('django.db.models.fields.files.FileField', [], {'max_length': '100', 'null': 'True', 'blank': 'True'}),
            'game_group': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['main.GameGroup']"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'media_type': ('django.db.models.fields.CharField', [], {'max_length': '64'})
        },
        u'main.membership': {
            'Meta': {'object_name': 'Membership'},
            'game_group': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['main.GameGroup']"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'role': ('django.db.models.fields.CharField', [], {'max_length': '64'}),
            'user': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['auth.User']"})
        },
        u'main.round': {
            'Meta': {'object_name': 'Round'},
            'correct_answer': ('django.db.models.fields.CharField', [], {'max_length': '32'}),
            'game': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['main.Game']"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'nbr': ('django.db.models.fields.IntegerField', [], {}),
            'points': ('django.db.models.fields.IntegerField', [], {})
        }
    }

    complete_apps = ['main']