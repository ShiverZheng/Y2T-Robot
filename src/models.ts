/* eslint-disable @typescript-eslint/no-explicit-any */
export enum Method {
    Get = 'GET',
    Put = 'PUT',
    Post = 'POST',
    Delete = 'DELETE'
}

export const MethodInPath: { [key: string]: string }  = {
	GET: 'Get',
	POST: 'Post',
	PUT: 'Put',
	DELETE: 'Delete'
}

export interface Content {
    method: Method
    request: any
    response: any
}

export interface TireSeed {
    path: string
    originalPath: string
    content: Content
}

export interface Config {
    port: number
    username: string
    password: string
    email: string
    registry: string
    protocol: string
    hostname: string
    pathname: string
    projectUrl: string
    accessToken: string
    dingTalkUrl: string
    appSecret: string
    secret: string
    projectsConfigsUrl: string
}

export interface DingBotMessage {
    atUsers: { dingtalkId: 'string' }[]
    chatbotCorpId: string
    chatbotUserId: string
    conversationId: string
    conversationTitle: string
    conversationType: string
    createAt: number
    isAdmin: boolean
    isInAtList: boolean
    msgId: string
    msgtype: string
    senderCorpId: string
    senderId: string
    senderNick: string
    senderStaffId: string
    sessionWebhook: string
    sessionWebhookExpiredTime: number
    text: {
        content: string
    }
}

export enum MessageType {
    MD = 'actionCard',
    Text = 'text'
}

export interface ProjectConfig {
    pid: string
    desc: string
    token: string
    name: string
}