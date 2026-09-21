// Minimal stand-in for webvpn.swufe.edu.cn / a WebVPN upstream, used by the app smoke runs.
//
//   node apps/desktop/test/fixtures/portal-stub.mjs --port 19080 [--mode ok|expired]
//
// GET  /            → ok: 200 + Set-Cookie: wrdvpn_session=STUB-SESSION; expired: 302 → /login
// GET  /login       → tiny login page (form POST /login sets the cookie and redirects to /)
// GET  /__mode?expired=0|1 → switch modes at runtime (no restart)
// any other path    → the "rewritten" upstream response (echoes path + received Cookie)

import { createServer } from 'node:http'

function argValue(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const port = Number(argValue('port', '19080'))
const sessionCookie = 'wrdvpn_session=STUB-SESSION'
let expired = argValue('mode', 'ok') === 'expired'

function respondJson(res, body) {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)

  if (url.pathname === '/__mode') {
    expired = url.searchParams.get('expired') === '1'
    respondJson(res, { expired })
    return
  }

  if (expired) {
    res.writeHead(302, { location: '/login' })
    res.end()
    return
  }

  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'set-cookie': `${sessionCookie}; Path=/`,
    })
    res.end('<html><body><h1>WebVPN STUB</h1><p>已登录</p></body></html>')
    return
  }

  if (url.pathname === '/login') {
    if (req.method === 'POST') {
      res.writeHead(302, { location: '/', 'set-cookie': `${sessionCookie}; Path=/` })
      res.end()
      return
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(
      '<html><body><h1>WebVPN STUB 登录</h1>' +
        '<form action="/login" method="post"><button type="submit">登录</button></form>' +
        '</body></html>',
    )
    return
  }

  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'set-cookie': 'UPSTREAM=1; Domain=.swufe.edu.cn; Path=/',
  })
  res.end(JSON.stringify({ stub: 'rewritten', path: url.pathname, cookie: req.headers.cookie ?? null }))
})

server.listen(port, '127.0.0.1', () => {
  console.log(`portal-stub listening on http://127.0.0.1:${port} expired=${expired}`)
})
