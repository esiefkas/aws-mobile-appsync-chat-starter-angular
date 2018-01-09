import { Component, Input } from '@angular/core';
import { AppsyncService } from '../appsync.service';
import { v4 as uuid } from 'uuid';
import createMessage from '../graphql/mutations/createMessage';
import getConversationMessages from '../graphql/queries/getConversationMessages';
import { unshiftMessage, constants } from '../chat-helper';
import Message from '../types/message';
import Amplify, { Analytics } from 'aws-amplify';
import aws_exports from '../../aws-exports';

@Component({
  selector: 'app-chat-input',
  templateUrl: './chat-input.component.html',
  styleUrls: ['./chat-input.component.css']
})
export class ChatInputComponent {

  message = '';

  @Input() conversation: any;
  @Input() senderId: string;
  constructor(private appsync: AppsyncService) {
    Amplify.configure(aws_exports);
   }

  createNewMessage() {
    const date = Date.now();
    const mID = uuid();
    const message: Message = {
      conversationId: this.conversation.id,
      content: this.message,
      createdAt: `${date}`,
      sender: this.senderId,
      isSent: false,
      id : `${date}-${mID}`
    };
    console.log('new message', message);
    this.message = '';
    this.appsync.client.hydrated().then(client => {
      client.mutate({
        mutation: createMessage,
        variables: message,

        optimisticResponse: () => ({
          createMessage: {
            ...message,
            __typename: 'Message'
          }
        }),

        update: (proxy, {data: { createMessage: _message }}) => {

          const options = {
            query: getConversationMessages,
            variables: { conversationId: this.conversation.id, first: constants.messageFirst }
          };

          const data = proxy.readQuery(options);
          const _tmp = unshiftMessage(data, _message);
          proxy.writeQuery({...options, data: _tmp});
        }
      }).then(({data}) => {
        console.log('mutation complete', data);
      }).catch(err => console.log('Error creating message', err));
    });
    Analytics.record('Chat MSG Sent');
  }
}
