from django.contrib.auth import get_user_model
from rest_framework import serializers, models
# from views import
UserModel = get_user_model()
from allauth.account.utils import setup_user_email
from rest_auth.registration.serializers import RegisterSerializer
from rest_auth.serializers import PasswordResetSerializer
from ngApp.forms import MyPasswordResetForm
from users.models import UserChatRecords, UserChannels, FriendChannels

class MyRegisterSerializer(RegisterSerializer):
    first_name = serializers.CharField()
    last_name = serializers.CharField()

    def get_cleaned_data(self):
        super(MyRegisterSerializer, self).get_cleaned_data()
        return {
            'username': self.validated_data.get('username', ''),
            'password1': self.validated_data.get('password1', ''),
            'email': self.validated_data.get('email', ''),
            'first_name': self.validated_data.get('first_name', ''),
            'last_name': self.validated_data.get('last_name', '')
        }



class ResetPasswordSerializer(PasswordResetSerializer):
    password_reset_form_class = MyPasswordResetForm



class ChatRecordsSerializer(serializers.ModelSerializer):

    class Meta:
        model = UserChatRecords
        fields = ('user','uuid', 'created', 'modified')

#
# class UserModelSerializer(serializers.RelatedField):
#     class Meta:
#         models = UserModel

class FriendField(serializers.ModelSerializer):

    class Meta:
        model = FriendChannels
        fields = ('user', 'channel')

class UserChannelsSerializer(serializers.ModelSerializer):
    friend = FriendField(many=True)

    class Meta:
        model = UserChannels
        fields = ('user', 'friend')

    def create(self, validated_data):
        friends = validated_data.pop('friend')
        uc = UserChannels.objects.filter(**validated_data)
        if (uc.exists()):
            uc = uc.first()
        else:
            uc = UserChannels.objects.create(**validated_data)
        for friend_data in friends:
            if not uc.friend.filter(user=friend_data['user']).exists():
                uc.friend.add(FriendChannels.objects.create(**friend_data))
        return uc