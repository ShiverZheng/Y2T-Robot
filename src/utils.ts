/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { TireSeed, MethodInPath } from './models'

/**
 * Sleep
 * @param ms number 
 * @returns {Promise<void>}
 */
export const sleep = (ms: number): Promise<void> => new Promise<void>(r => setTimeout(() => r(), ms))

const removeEscapedCharacters = (str: string): string => {
	// eslint-disable-next-line no-control-regex
	if (str) return str.replace(/\u0000/g, '')
	return str
} 

/**
 * Keep only the last pair of parentheses
 * /a/b/{c}/{d}/{e} => /a/b/{e}
 * @param str string
 * @returns {string} Cut string
 */
export const cutOffPath = (str: string): string => {
	const matched = str.match(/{/g)
	if (matched) {
		const parts = str.split('/')
		const len = parts.length
		let j = 0
		const result = []
		for (let i = 0; i < len; i++) {
			const part = parts[i]
			if (part.includes('{') && j < matched.length - 1) {
				j++
			} else {
				result.push(part)
			}
		}
		return result.join('/')
	}
	return str
}

/**
 * Format YApi's JSON to Tire's data
 * @param data any YApi's JSON
 * @returns {TireSeed[]} The data Tire want
 */
export const formatJSON = (data: any): TireSeed[] => {
	const result: TireSeed[] = []
	for (const d of data) {
		const list = d.list
		for (const l of list) {
			const inner: TireSeed = {
				path: '/' + MethodInPath[l.method] + cutOffPath(l.path),
				originalPath: l.path,
				content: {
					request: removeEscapedCharacters(l.req_body_other),
					response: removeEscapedCharacters(l.res_body),
					method: l.method,
				}
			}
			result.push(inner)
		}
	}
	return result
}

/**
 * Generate signature to check whether the request comes from DingBot
 * https://developers.dingtalk.com/document/robots/enterprise-created-chatbot
 * @param timestamp string
 * @param appSecret string
 * @returns {string} Encoded Secret
 */
export const generateSign = (timestamp: string, appSecret: string): string => {
	const stringToSign = timestamp + '\n' + appSecret
	const q = CryptoJS.HmacSHA256(stringToSign, appSecret)
	const hashInBase64 = CryptoJS.enc.Base64.stringify(q)
	return encodeURI(hashInBase64)
}

/**
 * Verify Sign
 * @param sign string
 * @param timestamp string
 * @param appSecret string
 * @returns {boolean} Is it verified
 */
export const verifySign = (sign: string, timestamp: string, appSecret: string): boolean => {
	if (!sign || !timestamp || !appSecret) return false
	generateSign(timestamp, appSecret)
	return generateSign(timestamp, appSecret) === sign
}

export const DOUBT = '[疑问]'
export const CREAZY = '[忙疯了]'

const badEmoji = ['[发呆]', '[惊愕]', '[欠扁]', '[投降]', '[单挑]', '[在吗]', '[暗中观察]', '[流鼻血]', '[跪了]', '[无聊]']
const badMsg = ['出错了啊', '看看咋回事', '这什么情况', '我觉得这样不好']
export const randomEmoji = () => badEmoji[Math.floor(Math.random() * badEmoji.length)]
export const randomBadEmojiWithMsg = () => randomEmoji() + ' ' + badMsg[Math.floor(Math.random() * badMsg.length)]

const niceMsg = ['搞定了！', '客官请查收', '啪的一下，就很快啊！', '好了，求打赏～', '请享用']
const niceEmogi = ['[你强]', '[收到]', '[OK]', '[吃瓜]', '[爱意]', '[对勾]', '[推眼镜]', '[呲牙]', '[自信]']
export const randomNiceEmoji = () => niceEmogi[Math.floor(Math.random() * niceEmogi.length)]
export const randomNiceMsg = () => randomNiceEmoji() + ' ' + niceMsg[Math.floor(Math.random() * niceMsg.length)]

export class I18n {
	static local = {
		'timeout': {
			zhs: '超时了嗷！',
			enu: 'Network connection timed out'
		},
		'notExist': {
			zhs: '没有id为%t的项目',
			enu: 'No exist project id like %t'
		},
		'bb': {
			zhs: '##### 你可以@我并发送如下指令：\n- *id* 生成定义文件\n- *list* 查看已配置项目\n- *refresh* 刷新项目配置文件\n- *bb* 帮助模式 \n > 你发其他的我也不知道',
			enu: '',
		},
		'configs': {
			zhs: '获取配置文件出问题了！',
			enu: 'Something error when get projects configs'
		},
		'refresh': {
			zhs: `成功更新配置 ${randomNiceEmoji()}`,
			enu: 'Projects config refreshed'
		}
	}
	
	/**
	 * Get I18n text
	 * @param key string
	 * @param value string | number Optional, the value your want to replaced.
	 * @returns Local text
	 */
	static t = (key: keyof typeof I18n.local, value?: string | number): {
		zhs: string;
		enu: string;
	} => {
		const local = I18n.local[key]
		if (value) {
			for (const k in local) {
				local[k as  keyof typeof local] = local[k as  keyof typeof local].replace('%t', value.toString())
			}
		} 
		return local
	} 
}