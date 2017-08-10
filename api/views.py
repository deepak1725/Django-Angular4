from django.contrib.auth.models import User
from serializers import UserSerializer, PasswordSerializer
from rest_framework.authentication import SessionAuthentication, BasicAuthentication
from rest_framework.response import Response
from rest_framework import viewsets
from rest_framework.decorators import detail_route, list_route
from rest_framework import status
from django.http import HttpResponse



class UsersViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = []
    authentication_classes = []


    # @detail_route(url_path='password/(?P<number>[0-9]+)')
    # def password(self, request,pk=None, number=None):
    #     password = request.POST.get('password','')
    #     return HttpResponse("Wow! It Works")


