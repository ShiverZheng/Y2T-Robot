/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs'
import http from 'http'
import path from 'path'
import axios from 'axios'
import url, { URL } from 'url'
import prettier from 'prettier'
import { spawn } from 'promisify-child-process'
import CryptoJS from 'crypto-js'
import Tire from './core/Tire'
import { Config, DingBotMessage, MessageType, ProjectConfig } from './models'
import { formatJSON, sleep, verifySign, generateSign, randomBadEmojiWithMsg, randomEmoji, randomNiceMsg, I18n, DOUBT, CREAZY } from './utils'

const configJSON = fs.readFileSync('config.json', 'utf8')
if (!configJSON) throw new Error('config.json Not Found')
const config = JSON.parse(configJSON) as Config

let projectsConfig: ProjectConfig[] | null = null

let working = false

const getConfig = async (pid: string) => {
	if (!projectsConfig) {
		projectsConfig = await getProjectsConfig()
	}
	const t = I18n.t('notExist', pid)
	const p = projectsConfig?.find(v => v.pid === pid)
	if (!p) throw new Error(t.enu)
	const decode = CryptoJS.AES.decrypt(p.token, config.secret).toString(CryptoJS.enc.Utf8)
	if (!decode.length) {
		console.log(t.enu)
		throw new Error(t.zhs)
	}
	return {
		...p,
		token: decode
	}
}

const getProjectsConfig = async () => {
	const res = await axios.get<ProjectConfig[]>(config.projectsConfigsUrl)
	if (res.status === 200 && res.statusText === 'OK') return res.data
	const t = I18n.t('configs')
	console.log(t.enu)
	throw new Error(t.zhs)
}

const generate = async (json: any, projectID: string) => {
	console.log('before generate')
	const projectConfig = await getConfig(projectID)
	const data = formatJSON(json)
				
	const t = new Tire()
	for (const d of data) {
		t.insert(d)
	}
	t.build()
				
	const formated = prettier.format(t.result, { parser: 'babel-ts' })
				
	const indexFileName = 'index.d.ts'
	const generatedPath = path.resolve(__dirname, '../generated') 
	const isExist = fs.existsSync(generatedPath)
	if (!isExist) fs.mkdirSync(generatedPath)
	const p = (fileName: string) => path.resolve(__dirname, `../generated/${fileName}`)
	fs.writeFile(p(indexFileName), formated, (err) => {
		if (err) {
			console.error(err)
			return false
		}
		console.log(`${indexFileName} created !`)
	})

	const packageFileName = 'package.json'
	const version = `1.0.0-${new Date().getTime()}`
	const packageJson = {
		name: `@types/${projectConfig.name}`,
		version: `${version}`,
		main: 'index.d.ts',
		author: config.username,
		license: 'MIT'
	}
	fs.writeFile(
		p(packageFileName),
		JSON.stringify(packageJson, null, 4),
		(err) => {
			if (err) {
				console.error(err)
				return false
			}
			console.log(`${packageFileName} created !`)
		},
	)
	return `@types/${projectConfig.name}@${version}` 
}

const notice = async (content: string, userId: string, msgType: MessageType = MessageType.Text) => {
	console.log('==> User ID: ', userId, content, msgType)
	const time = new Date().getTime().toString()
	const encodeSign = generateSign(time, config.appSecret)
	const accessToken = config.accessToken
	let data = null
	if (msgType === MessageType.Text) {
		data = {
			at: {
				atUserIds: [userId],
			},
			msgtype: msgType,
			text: { content }
		}
	} else {
		data = {
			at: {
				atUserIds: [userId],
			},
			'msgtype': msgType,
			'actionCard': {
				'text': content, 
			}
		}
	}
	
	const res = await axios.post(
		`${config.dingTalkUrl}?access_token=${accessToken}&timestamp=${time}&sign=${encodeSign}`,
		JSON.parse(JSON.stringify(data)),
		{ headers: { ContentType: 'application/json' } }
	)
	console.log('<== DingBot:', res.status, res.statusText, res.data)
}

const getAPI = async (projectID: string): Promise<any> => {
	console.log('project id: ', projectID)
	const projectConfig = await getConfig(projectID)
	const requestURL = new URL(url.format({
		protocol: config.protocol,
		hostname: config.hostname,
		pathname: config.pathname,
		query: {
			type: 'json',
			status: 'all',
			token: projectConfig.token,
			pid: projectConfig.pid,
		}
	}))
	const res = await axios.get(requestURL.toString())
	return res.data
}

const handleRefresh = async () => {
	projectsConfig = await getProjectsConfig()
	const t = I18n.t('refresh')
	notice(t.zhs, MessageType.Text)
}

const handleRes = (res: http.ServerResponse, code: number, data = '') => {
	res.statusCode = code 
	res.setHeader('Content-Type', 'text/plain')
	if (code === 200) {
		const content = 'ok'
		res.statusMessage = data ? data : content
		res.end(content)
	} else if (code === 400) {
		res.statusMessage = 'Bad Request'
		res.end(data)
	} else if (code === 413) {
		res.statusMessage = 'The request was larger than the server is able to handle.'
		res.connection?.destroy()
	} else if (code === 403) {
		const content = 'Illegal Request'
		res.statusMessage = content
		res.end(content)
	} else if (code === 500) {
		res.statusMessage = 'Internal Error'
		res.end(data)
	} else if (code === 504) {
		res.statusMessage = 'Timeout'
		res.end(data)
	}
}

getProjectsConfig().then(c => projectsConfig = c)

const server = http.createServer(async (req, res) => {
	if (!verifySign(req.headers.sign as string, req.headers.timestamp as string, config.appSecret)) {
		handleRes(res, 403)
		return
	}
	if (req.method === 'POST') {
		let body = ''

		req.on('data', (data) => {
			body += data
			// Too much POST data, kill the connection!
			// 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ===> 1MB
			if (body.length > 1e6) {
				body = ''
				handleRes(res, 413)
			}
		})

		req.on('end', async () => {
			const data = JSON.parse(body) as DingBotMessage
			if (!data.text || !data.text.content) {
				handleRes(res, 403)
				return
			}
			const content = data.text.content.trim()
			const userId = data.senderStaffId
			switch (true) {
			case content === 'bb': {
				const t = I18n.t('bb')
				notice(t.zhs, userId, MessageType.MD)
				handleRes(res, 200)
				break
			}
			case content === 'refresh': {
				await handleRefresh()
				break
			}
			case content === 'list': {
				let list = ''
				if (projectsConfig) {
					list = projectsConfig
						.sort((a, b) => parseInt(a.pid) - parseInt(b.pid))
						.map(c => `- ${c.pid} ${c.name} - ${c.desc}`).join('\n')
					handleRes(res, 200)
				}
				notice(list, userId, MessageType.MD)
				break
			}
			case /^[0-9]*$/.test(content): {
				if (working) {
					handleRes(res, 200)
					notice(CREAZY, userId)
					return
				}
		
				if (!projectsConfig) {
					projectsConfig = await getProjectsConfig()
				}
				const isExist = projectsConfig?.find(p => p.pid === content)
				if (!isExist) {
					handleRes(res, 400)
					notice(`${I18n.t('notExist', content).zhs} ${randomEmoji()}`, userId)
					return
				}
		
				const work = async () => {
					try {
						working = true
						const apis = await getAPI(content)
						const tag = await generate(apis, content)
						console.log('generated!')
			
						const { stdout, stderr } = await spawn(
							'npm run publish:shell',
							[],
							{
								stdio: 'inherit',
								encoding: 'utf8',
								shell: true,
								env: {
									...process.env,
									REGISTRY: `${config.registry}`,
									USERNAME: `${config.username}`,
									PASSWORD: `${config.password}`,
									EMAIL: `${config.email}`
								},
							}
						)
						working = false 
						console.log(stdout)
						console.log(stderr)
						console.log('--------------published--------------')
						console.log(tag)
						return ({
							statusCode: 200,
							data: tag
						})
					} catch (error) {
						return ({
							statusCode: 500,
							data: (error as Error).message as string,
						})
					}
				}
		
				const timeout = async () => {
					await sleep(10 * 1000)
					return ({
						statusCode: 504,
						data: I18n.t('timeout'),
					})
				}
				const ret = await Promise.race([
					timeout(),
					work()
				])

				let text = ''
				if (typeof ret.data === 'string') {
					text = ret.data
				} else {
					text = ret.data.zhs
				}
				
				handleRes(res, ret.statusCode, text)
				notice(
					ret.statusCode === 200 
						? `${randomNiceMsg()} \n ${text}`
						:`${randomBadEmojiWithMsg()} \n ${text}`,
					userId,
				)
				
				working = false
				break
			}
			default:
				notice(DOUBT, userId)
				handleRes(res, 200)
				return
			}
		})
	}
	
})

server.listen(config.port)
console.log(`server is running at http://0.0.0.0:${config.port}/`)