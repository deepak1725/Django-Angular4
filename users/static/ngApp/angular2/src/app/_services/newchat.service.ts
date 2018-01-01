import { element } from 'protractor';
import { Observable } from 'rxjs/Rx';
import { Injectable } from '@angular/core';
import { Http, Headers, RequestOptions, Response } from '@angular/http';
import { Constants } from '../_store/constants'
// import { Observable } from 'rxjs/Observable';
import { User } from '../_models/user';
import { PubNubAngular } from 'pubnub-angular2';
import { DashboardComponent } from '../protected/dashboard/dashboard.component';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import { NgRedux, select } from '@angular-redux/store';
import { rootReducer, IAppState } from '../_store/store';
import * as ChatEngineCore from 'chat-engine';
import { environment } from '../../environments/environment';
import { UserService } from './user.service';


@Injectable()
export class NewchatService {
    username: string;
    fullName: string;
    ChatEngine:any;
    room: string = 'general';
    rooms: Array<any> = ['general', 'annoucement'];
    privateRooms: Array<any> = [];
    currentChatObject:any;
    basicRooms:any;
    allUsers: any = [];
    // message: any = [];
    globalChannel:string = 'BhaiLaptop'
    me:any;
    channelInput: string = this.route.snapshot.paramMap.get('channel');
    myPrivateChannels: Array<any> = []

    @select(['public_channel','payload']) readonly publicChats$: Observable<any[]>;
    @select(['private_channel','payload']) readonly privateChats$: Observable<any[]>;
    @select(['direct_channel','payload']) readonly directChats$: Observable<any[]>;
    @select(['current_channel','payload']) readonly currentChannel$: Observable<any[]>;
    @select(['message','payload']) readonly messages$: Observable<any[]>;

    constructor(
        private ngRedux: NgRedux<IAppState>,
        private route: ActivatedRoute,
        private UserServicee: UserService,
    ) {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        this.username = currentUser.user.username;
        this.fullName = currentUser.user.first_name + ' ' + currentUser.user.last_name;
    }

    callStack = () => {
        this.UserServicee.getUserChannelDetails().subscribe(
            (response) => { 
                console.log("Yeag", response)
                this.myPrivateChannels = response.data.friend
                this.initialize();
                this.lobby();
            },
            (error) => {
                console.log("Error")
            }
        )
        
    }
    
    initialize = () => {
        this.ChatEngine = ChatEngineCore.create({
            publishKey: environment.PUBNUB_PUB_KEY,
            subscribeKey: environment.PUBNUB_SUB_KEY,
        },{
            globalChannel: this.globalChannel
        });

        
    }

    lobby = () => {

        
        //Initializing User
        this.ChatEngine.connect(this.username, {
            team: 'red'
        });

        //Setting up Socket
        this.ChatEngine.on('$.ready', (data) => {
            let me = this.me = data.me;
            this.updateUserState(me);
            
            this.rooms.forEach(room => {
                this.createRoom(room);
            });

            // this.updateChatObject();
            
            this.publicChannelListing()
            this.eventListerners()
        });
    }

    createRoom = (room, isPrivate=false) => {
        
        this.basicRooms = new (this.ChatEngine).Chat(room, isPrivate);
        
        if (this.isChannelCurrent(room)) {
            this.currentChatObject = this.basicRooms;
        }
        this.subscribe(this.basicRooms)   
    }

    updateChatObject = (channel, isPrivate = false) => {
        this.currentChatObject = new (this.ChatEngine).Chat(channel, isPrivate);
        this.history(this.currentChatObject)
    }

    subscribe = (basicRoom) => {

        basicRoom.on('message', (payload) => {
            this.renderMessage(payload)
        });
    }

    renderMessage = (payload) => {
        let newData = {
                        channel: this.channelInput,
                        data: payload.data,
                        sender: payload.sender
                    }
        this.ngRedux.dispatch({ type: Constants.MESSAGEADD, message: newData })        
        // this.message.push(payload);
    }

    history = (currentChatObject) => {
        // wait for our chat to connect
        this.ngRedux.dispatch({ type: Constants.MESSAGEREMOVE, payload: {} })        
        
            this.currentChatObject.search({
                reverse: true,
                event: 'message',
                limit: 50
            }).on('message', (data) => {
                this.renderMessage(data);

            });
        
    }

    eventListerners = () => {
        this.ChatEngine.on('$.created.chat', (data, chat) => {
            console.log('A Chat is Created');
            
            this.fetchChannel(chat.channel);
        });

        (this.me).direct.on('message', (payload) => {
            console.log(payload.sender.uuid, 'sent your a game invite on the map', payload.data.map);
        });

        this.currentChatObject.on('$.join', (data) => {
            console.log('User has joined the room!');
        });

        this.ChatEngine.on('$.created.user', (data, user) => {
            console.log("User is created", user)
            
            Observable.forkJoin(
                this.UserServicee.getUserDetails(user.uuid),
                this.UserServicee.getChannelName()
            ).subscribe(resp => {
                return this.UserServicee.addUserChannelDetails(resp[0].data.id, resp[1].data.name)
                    .subscribe((response) => {
                        let channelName = response.data.friend[0].channel
                        let newChat = new (this.ChatEngine).Chat(channelName, true);
                        
                    })
            }
        )

            this.ngRedux.dispatch({ type: Constants.USERADD, payload:[user] })    
            
        });

        this.me.direct.on('$.invite', (payload) => {
            console.log("You got annn Invite", payload);
            // this.subscribe();
        });

        this.currentChatObject.on('$.online.*', (data) => {
            this.allUsers.push(data.user);
        });

        (this.currentChatObject).on('$.offline.*', (data) => {
            console.log("SomeOne got offline");
        });
    }

    updateUserState = (me) => {
        me.update({
            lastOnline: new Date(),
            nickName: this.username,
            fullName: this.fullName
        });
    }


    publishDirectMessage = (uuid) => {
            let receiver = new (this.ChatEngine).User(uuid);            
            receiver.direct.emit('message', { map: 'de_dust' });
    }

   

    publicChannelListing = () => {
        
        let allChannels = this.ChatEngine.chats
        for (let element in allChannels) {
            this.fetchChannel(element);
        }
        
    }

    fetchChannel = (element) => {
        let chat = element.split("#");
        let isCurrentChannel = false;

        if (chat[2] == 'public.') {
            this.ngRedux.dispatch({ type: Constants.PUBLICCHANNELADD, payload: chat[3] })
            isCurrentChannel = this.isChannelCurrent(chat[3]);
        }

        if (chat[2] == 'private.') {
            console.log("Fired2", chat[3])
            
            for(const iterator of this.myPrivateChannels) {
                console.log(iterator);    
            }
            let payload = {
                channel: chat[3],
                uuid: chat[3]
            }
            if ((this.ChatEngine.chats).hasOwnProperty(element)) {
                element = this.ChatEngine.chats[element];
                console.log("Elememn",this.ChatEngine.chats);
                // this.sendInvite(this.username, element)
            }

            this.ngRedux.dispatch({ type: Constants.PRIVATECHANNELADD, payload: payload })    
            isCurrentChannel = this.isChannelCurrent(chat[3]);
        }

        // if (chat[4] == 'direct') {
        //     let payload = {
        //         channel : chat[2],
        //         uuid: chat[2]
        //     }
        //     if ((this.ChatEngine.chats).hasOwnProperty(element)) {
        //         element = this.ChatEngine.chats[element];
        //     }
        //     this.ngRedux.dispatch({ type: Constants.DIRECTCHANNELADD, payload: payload })    
        //     isCurrentChannel = this.isChannelCurrent(chat[2]);
        // }

        
        if (isCurrentChannel) { //Checking Current Channel
            let allChats = this.ChatEngine.chats;
            if ((this.ChatEngine.chats).hasOwnProperty(element)){
                element = allChats[element];
            }
            
            this.ngRedux.dispatch({ type: Constants.CURRENTCHANNELADD, payload: element })    
        }
    }

    isChannelCurrent = (channel) => {
        if (channel == this.channelInput) {
            return true;
        }
        return false;
    }

    shiftChannel = (channel: string, isPrivate: boolean) => {
        let channelAdd = null;
        
        if (isPrivate){
            // channelAdd = this.sendInvite(channel)
            // this.ngRedux.dispatch({ type: Constants.CURRENTCHANNELADD, payload: secretChat })    
            
        }else{

            channelAdd = (this.ChatEngine).Chat(channel);
        }
        this.ngRedux.dispatch({ type: Constants.CURRENTCHANNELADD, payload: channel })    

    }


    sendInvite = (invitedUuid, chat) => {
        let user = this.ChatEngine.global.users[invitedUuid];
        chat.invite(user);
        console.log("You sent an Invite");

        this.subscribe(chat);
        console.log(chat);
        

        return chat;

    }

    publish = (message="") => {
        this.currentChatObject.emit('message', {
            text: message,
            nickName: this.username,
            fullName: this.fullName,
            date: new Date()
        });
    }

    global = () => {
        this.ChatEngine.global.on('$.state', (payload) => {
            console.log(payload.user + ' updated state: ' + payload.state);
        });
    }
        
    

} 