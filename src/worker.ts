export interface Env {
	DB: D1Database;
}

interface CalendarEvent {
	id: string;
	title: string;
	date: string;
	startTime?: string;
	endTime?: string;
	memo?: string;
	createdBy: string;
	createdAt: string;
	updatedAt: string;
}

// API handlers
async function handleApi(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname;

	const corsHeaders = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
	};

	if (request.method === 'OPTIONS') {
		return new Response(null, { headers: corsHeaders });
	}

	try {
		if (path === '/api/events') {
			if (request.method === 'GET') {
				const month = url.searchParams.get('month');
				if (!month) {
					return new Response(JSON.stringify({ error: 'Missing month parameter' }), {
						status: 400,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					});
				}

				const [year, monthNum] = month.split('-');
				const startDate = new Date(Number(year), Number(monthNum) - 1, 1)
					.toISOString()
					.split('T')[0];
				const endDate = new Date(Number(year), Number(monthNum), 0)
					.toISOString()
					.split('T')[0];

				const { results } = await env.DB
					.prepare(
						'SELECT * FROM events WHERE date >= ? AND date <= ? ORDER BY date, startTime'
					)
					.bind(startDate, endDate)
					.all<CalendarEvent>();

				return new Response(JSON.stringify(results || []), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			if (request.method === 'POST') {
				const body = await request.json<{
					title: string;
					date: string;
					startTime?: string;
					endTime?: string;
					memo?: string;
					createdBy: string;
				}>();
				const { title, date, startTime, endTime, memo, createdBy } = body;

				if (!title || !date) {
					return new Response(JSON.stringify({ error: 'Title and date required' }), {
						status: 400,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					});
				}

				const id = crypto.randomUUID();
				const now = new Date().toISOString();

				await env.DB
					.prepare(
						'INSERT INTO events (id, title, date, startTime, endTime, memo, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
					)
					.bind(id, title, date, startTime || null, endTime || null, memo || null, createdBy, now, now)
					.run();

				return new Response(
					JSON.stringify({
						id,
						title,
						date,
						startTime,
						endTime,
						memo,
						createdBy,
						createdAt: now,
						updatedAt: now,
					}),
					{ status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
				);
			}
		}

		if (path.startsWith('/api/events/') && request.method === 'PUT') {
			const id = path.split('/')[3];
			const body = await request.json<{
				title?: string;
				date?: string;
				startTime?: string;
				endTime?: string;
				memo?: string;
			}>();

			const now = new Date().toISOString();

			const result = await env.DB
				.prepare(
					'UPDATE events SET title = ?, date = ?, startTime = ?, endTime = ?, memo = ?, updatedAt = ? WHERE id = ?'
				)
				.bind(body.title, body.date, body.startTime || null, body.endTime || null, body.memo || null, now, id)
				.run();

			if (!result.success) {
				return new Response(JSON.stringify({ error: 'Failed to update event' }), {
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			return new Response(JSON.stringify({ success: true }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		if (path.startsWith('/api/events/') && request.method === 'DELETE') {
			const id = path.split('/')[3];

			const result = await env.DB.prepare('DELETE FROM events WHERE id = ?').bind(id).run();

			if (!result.success) {
				return new Response(JSON.stringify({ error: 'Failed to delete event' }), {
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			return new Response(JSON.stringify({ success: true }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		if (path === '/api/calendar.ics') {
			const { results } = await env.DB
				.prepare('SELECT * FROM events ORDER BY date, startTime')
				.all<CalendarEvent>();

			const events = results || [];
			const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

			let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Family Calendar//NONSGML Family Calendar v1.0//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\nX-WR-CALNAME:家族の予定\nX-WR-TIMEZONE:Asia/Tokyo\n';

			events.forEach(event => {
				const dateStr = event.date.replace(/-/g, '');
				const startTime = event.startTime ? event.startTime.replace(/:/g, '') : '090000';
				const endTime = event.endTime ? event.endTime.replace(/:/g, '') : '180000';

				const dtstart = `${dateStr}T${startTime}`;
				const dtend = `${dateStr}T${endTime}`;
				const dtstamp = now;
				const uid = `${event.id}@family-calendar.workers.dev`;
				const summary = event.title;
				const description = event.memo || '';

				icsContent += `BEGIN:VEVENT\nUID:${uid}\nDTSTART:${dtstart}\nDTEND:${dtend}\nDTSTAMP:${dtstamp}\nCREATED:${dtstamp}\nDESCRIPTION:${description.replace(/\n/g, '\\n')}\nSUMMARY:${summary}\nSTATUS:CONFIRMED\nEND:VEVENT\n`;
			});

			icsContent += 'END:VCALENDAR';

			return new Response(icsContent, {
				status: 200,
				headers: {
					'Content-Type': 'text/calendar; charset=utf-8',
					'Content-Disposition': 'inline; filename="family-calendar.ics"',
					'Cache-Control': 'no-cache, no-store, must-revalidate',
				},
			});
		}
	} catch (error) {
		console.error('Error:', error);
		return new Response(JSON.stringify({ error: String(error) }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}

	return new Response('Not Found', { status: 404 });
}

// Serve HTML UI
const ALLOWED_EMAILS = ['taiki.38.33@gmail.com', 'erknm.21@docomo.ne.jp'];

function getHtmlResponse(): Response {
	return new Response(
		`<!DOCTYPE html>
<html lang="ja">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>家族の予定</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			min-height: 100vh;
			padding: 20px;
		}
		.container {
			max-width: 1200px;
			margin: 0 auto;
		}
		h1 {
			color: white;
			text-align: center;
			margin-bottom: 30px;
			font-size: 2.5em;
		}
		#auth { display: none; }
		#app { display: none; }
		.auth-box {
			max-width: 400px;
			margin: 100px auto;
			background: white;
			padding: 40px;
			border-radius: 12px;
			box-shadow: 0 10px 30px rgba(0,0,0,0.2);
		}
		.auth-box h2 {
			text-align: center;
			margin-bottom: 30px;
			color: #333;
			font-size: 1.8em;
		}
		.auth-form .form-group {
			margin-bottom: 20px;
		}
		.auth-form label {
			display: block;
			margin-bottom: 8px;
			color: #555;
			font-weight: 600;
		}
		.auth-form input {
			width: 100%;
			padding: 12px 15px;
			border: 2px solid #e0e0e0;
			border-radius: 8px;
			font-size: 16px;
		}
		.auth-form input:focus {
			outline: none;
			border-color: #667eea;
		}
		.auth-form button {
			width: 100%;
			padding: 12px;
			background: #667eea;
			color: white;
			border: none;
			border-radius: 8px;
			font-size: 16px;
			font-weight: 600;
			cursor: pointer;
		}
		.auth-form button:hover {
			background: #5568d3;
		}
		#authError {
			color: #ff6b6b;
			margin-top: 10px;
			display: none;
		}
		.auth-header {
			text-align: right;
			margin-bottom: 15px;
			font-size: 13px;
			color: white;
		}
		.logout-btn {
			background: #999;
			padding: 8px 16px;
			margin-left: 15px;
			font-size: 13px;
			color: white;
			border: none;
			border-radius: 5px;
			cursor: pointer;
		}
		.logout-btn:hover {
			background: #888;
		}
		.main {
			display: grid;
			grid-template-columns: 1fr 350px;
			gap: 20px;
		}
		@media (max-width: 768px) {
			.main {
				grid-template-columns: 1fr;
			}
		}
		.calendar-section {
			background: white;
			border-radius: 10px;
			padding: 20px;
			box-shadow: 0 10px 30px rgba(0,0,0,0.2);
		}
		.calendar-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 20px;
		}
		.calendar-header button {
			padding: 10px 15px;
			background: #667eea;
			color: white;
			border: none;
			border-radius: 5px;
			cursor: pointer;
			font-weight: bold;
		}
		.calendar-header button:hover {
			background: #5568d3;
		}
		.calendar-header h2 {
			font-size: 1.5em;
			color: #333;
		}
		.weekdays {
			display: grid;
			grid-template-columns: repeat(7, 1fr);
			gap: 5px;
			margin-bottom: 10px;
		}
		.weekday {
			text-align: center;
			font-weight: bold;
			color: #666;
			padding: 10px 0;
			font-size: 0.9em;
		}
		.days {
			display: grid;
			grid-template-columns: repeat(7, 1fr);
			gap: 5px;
		}
		@media (max-width: 600px) {
			.days {
				grid-template-columns: repeat(7, 1fr);
				gap: 3px;
			}
			.day {
				min-height: 100px !important;
				padding: 6px !important;
				font-size: 0.9em;
			}
			.day-num {
				font-size: 0.95em !important;
			}
			.event-badge {
				font-size: 0.75em !important;
				padding: 2px 4px !important;
				margin-bottom: 2px !important;
			}
		}
		.day {
			min-height: 150px;
			border: 1px solid #ddd;
			border-radius: 5px;
			padding: 10px;
			cursor: pointer;
			transition: all 0.2s;
			overflow-y: auto;
			background: white;
		}
		.day:hover {
			border-color: #667eea;
			background: #f0f4ff;
		}
		.day.other-month {
			background: #f9f9f9;
			color: #ccc;
		}
		.day.sunday {
			background: #ffebee;
		}
		.day.saturday {
			background: #e3f2fd;
		}
		.day.holiday {
			background: #fff3e0;
		}
		.day-num {
			font-weight: bold;
			font-size: 1.1em;
			color: #333;
			margin-bottom: 6px;
		}
		.day-events {
			font-size: 0.7em;
		}
		.event-badge {
			color: white;
			padding: 4px 6px;
			border-radius: 3px;
			margin-bottom: 4px;
			white-space: normal;
			word-break: break-word;
			font-weight: 600;
			font-size: 0.85em;
			line-height: 1.3;
			transition: all 0.2s;
		}
		.event-badge.selected {
			transform: scale(1.1);
			box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
			border: 2px solid white;
		}
		.form-section {
			background: white;
			border-radius: 10px;
			padding: 20px;
			box-shadow: 0 10px 30px rgba(0,0,0,0.2);
			border-top: 4px solid #667eea;
		}
		@media (max-width: 600px) {
			.form-section {
				padding: 15px;
				border-top: 6px solid #667eea;
			}
		}
		.form-section h3 {
			margin-bottom: 15px;
			color: #333;
		}
		.form-group {
			margin-bottom: 12px;
		}
		label {
			display: block;
			font-size: 0.9em;
			font-weight: 600;
			color: #555;
			margin-bottom: 4px;
		}
		input, textarea, select {
			width: 100%;
			padding: 10px;
			border: 1px solid #ddd;
			border-radius: 5px;
			font-family: inherit;
			font-size: 16px;
		}
		@media (max-width: 600px) {
			input, textarea, select {
				padding: 12px;
				font-size: 16px;
				border: 2px solid #ddd;
			}
		}
		input:focus, textarea:focus {
			outline: none;
			border-color: #667eea;
			box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
		}
		button.submit {
			width: 100%;
			padding: 12px;
			background: #667eea;
			color: white;
			border: none;
			border-radius: 5px;
			font-weight: bold;
			cursor: pointer;
			font-size: 16px;
		}
		@media (max-width: 600px) {
			button.submit {
				padding: 14px;
				font-size: 18px;
			}
		}
		button.submit:hover {
			background: #5568d3;
		}
		button.submit:disabled {
			background: #ccc;
			cursor: not-allowed;
		}
		button.delete {
			width: 100%;
			padding: 8px;
			margin-top: 8px;
			background: #ff6b6b;
			color: white;
			border: none;
			border-radius: 5px;
			cursor: pointer;
		}
		button.delete:hover {
			background: #ff5252;
		}
		.error {
			color: #ff6b6b;
			font-size: 0.85em;
			margin-top: 4px;
		}
		.success {
			color: #51cf66;
			font-size: 0.85em;
			margin-top: 4px;
		}
	</style>
</head>
<body>
	<div id="auth">
		<div class="auth-box">
			<h2>📅 長谷川家の予定</h2>
			<p style="text-align: center; color: #999; margin-bottom: 30px;">メールアドレスでログイン</p>
			<form id="login" class="auth-form">
				<div class="form-group">
					<label>メールアドレス</label>
					<input type="email" id="email" placeholder="メールアドレスを入力" required>
				</div>
				<button type="submit">ログイン</button>
				<div id="authError"></div>
			</form>
		</div>
	</div>

	<div id="app">
		<div class="container">
			<div class="auth-header">
				<span id="user"></span><button class="logout-btn" onclick="logout()">ログアウト</button>
			</div>
			<h1>📅 長谷川家の予定</h1>

			<div class="main">
				<div class="calendar-section">
					<div class="calendar-header">
						<button onclick="previousMonth()">← 前月</button>
						<h2 id="monthTitle"></h2>
						<button onclick="nextMonth()">翌月 →</button>
					</div>
					<div class="weekdays">
						<div class="weekday">日</div>
						<div class="weekday">月</div>
						<div class="weekday">火</div>
						<div class="weekday">水</div>
						<div class="weekday">木</div>
						<div class="weekday">金</div>
						<div class="weekday">土</div>
					</div>
					<div class="days" id="calendar"></div>
				</div>

				<div class="form-section">
					<h3 id="formTitle">新しい予定</h3>
					<form id="eventForm">
						<div class="form-group">
							<label>誰が</label>
							<select id="createdBy" required>
								<option value="">選択してください</option>
								<option value="taiki">太希</option>
								<option value="eiko">永李子</option>
								<option value="hinako">ひなこ</option>
								<option value="mahiro">まひろ</option>
								<option value="kousuke">こうすけ</option>
							</select>
						</div>
						<div class="form-group">
							<label>予定名</label>
							<input type="text" id="title" placeholder="例: 病院の診察" required>
						</div>
						<div class="form-group">
							<label>日付</label>
							<input type="date" id="date" required>
						</div>
						<div class="form-group">
							<label>開始時間</label>
							<input type="time" id="startTime">
						</div>
						<div class="form-group">
							<label>終了時間</label>
							<input type="time" id="endTime">
						</div>
						<div class="form-group">
							<label>メモ</label>
							<textarea id="memo" placeholder="メモを入力（例：確認が必要、要確認など）" rows="3"></textarea>
						</div>
						<div class="form-group">
							<label>画像を添付</label>
							<input type="file" id="memoImage" accept="image/*" style="padding: 8px; cursor: pointer;">
							<div id="imagePreview" style="margin-top: 10px;"></div>
						</div>
						<button type="submit" class="submit" id="submitBtn">追加</button>
						<button type="button" class="delete" id="deleteBtn" style="display: none;">削除</button>
						<button type="button" class="delete" style="background: #999; display: none;" id="cancelBtn">キャンセル</button>
						<div id="formError" class="error"></div>
						<div id="formSuccess" class="success"></div>
					</form>
				</div>
			</div>
		</div>
	</div>

	<script>
		const ALLOWED = ['taiki.38.33@gmail.com', 'erknm.21@docomo.ne.jp'];
		let currentDate = new Date();
		let selectedEvent = null;

		function isAuth() { return !!localStorage.getItem('auth'); }
		function showAuth() {
			document.getElementById('auth').style.display = 'block';
			document.getElementById('app').style.display = 'none';
		}
		function showApp() {
			document.getElementById('auth').style.display = 'none';
			document.getElementById('app').style.display = 'block';
			document.getElementById('user').textContent = localStorage.getItem('auth');
		}
		function logout() {
			localStorage.removeItem('auth');
			showAuth();
		}

		document.getElementById('login').addEventListener('submit', e => {
			e.preventDefault();
			const email = document.getElementById('email').value;
			if (ALLOWED.includes(email)) {
				localStorage.setItem('auth', email);
				showApp();
				loadAndSetup();
			} else {
				document.getElementById('authError').textContent = 'このメールアドレスはアクセス権がありません';
				document.getElementById('authError').style.display = 'block';
			}
		});

		const MEMBERS = {
			'taiki': { name: '太希', color: '#FF6B6B' },
			'eiko': { name: '永李子', color: '#4ECDC4' },
			'hinako': { name: 'ひなこ', color: '#FFE66D' },
			'mahiro': { name: 'まひろ', color: '#95E1D3' }
		};

		const JAPANESE_HOLIDAYS = {
			'2026-01-01': '元日',
			'2026-02-11': '建国記念の日',
			'2026-02-23': '天皇誕生日',
			'2026-03-20': '春分の日',
			'2026-04-29': '昭和の日',
			'2026-05-03': '憲法記念日',
			'2026-05-04': 'みどりの日',
			'2026-05-05': 'こどもの日',
			'2026-07-20': '海の日',
			'2026-08-10': '山の日',
			'2026-09-21': '敬老の日',
			'2026-09-22': '秋分の日',
			'2026-10-12': 'スポーツの日',
			'2026-11-03': '文化の日',
			'2026-11-23': '勤労感謝の日'
		};

		function formatDate(d) {
			return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
		}

		function isHoliday(dateStr) {
			return JAPANESE_HOLIDAYS[dateStr] !== undefined;
		}

		function formatYearMonth(d) {
			return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
		}

		async function loadEvents() {
			const month = formatYearMonth(currentDate);
			const res = await fetch('/api/events?month=' + month);
			return res.ok ? await res.json() : [];
		}

		async function renderCalendar() {
			const events = await loadEvents();
			const year = currentDate.getFullYear();
			const month = currentDate.getMonth();

			document.getElementById('monthTitle').textContent = year + '年 ' + (month + 1) + '月';

			const firstDay = new Date(year, month, 1);
			const lastDay = new Date(year, month + 1, 0);
			const startDate = new Date(firstDay);
			startDate.setDate(startDate.getDate() - firstDay.getDay());

			const calendar = document.getElementById('calendar');
			calendar.innerHTML = '';

			for (let i = 0; i < 42; i++) {
				const d = new Date(startDate);
				d.setDate(d.getDate() + i);

				const day = document.createElement('div');
				const dateStr = formatDate(d);
				let className = 'day' + (d.getMonth() !== month ? ' other-month' : '');

				if (d.getMonth() === month) {
					const dayOfWeek = d.getDay();
					if (dayOfWeek === 0) {
						className += ' sunday';
					} else if (dayOfWeek === 6) {
						className += ' saturday';
					} else if (isHoliday(dateStr)) {
						className += ' holiday';
					}
				}
				day.className = className;

				const dayEvents = events.filter(e => e.date === dateStr);

				let html = '<div class="day-num">' + d.getDate() + '</div>';
				html += '<div class="day-events">';
				dayEvents.forEach(e => {
					const color = MEMBERS[e.createdBy]?.color || '#999';
					const memberName = MEMBERS[e.createdBy]?.name || e.createdBy;
					html += '<div class="event-badge" style="background: ' + color + ';" data-event-id="' + e.id + '">[' + memberName + '] ' + e.title + '</div>';
				});
				html += '</div>';

				day.innerHTML = html;
				day.onclick = () => {
					if (d.getMonth() === month) {
						document.getElementById('date').value = dateStr;
						document.getElementById('title').focus();
						selectedEvent = null;
						updateForm();
					}
				};

				calendar.appendChild(day);
			}

			document.querySelectorAll('[data-event-id]').forEach(el => {
				el.style.cursor = 'pointer';
				el.addEventListener('click', function(e) {
					e.stopPropagation();
					const eventId = this.getAttribute('data-event-id');
					const event = events.find(ev => ev.id === eventId);
					if (event) selectEvent(event);
				});
			});
		}

		function previousMonth() {
			currentDate.setMonth(currentDate.getMonth() - 1);
			renderCalendar();
		}

		function nextMonth() {
			currentDate.setMonth(currentDate.getMonth() + 1);
			renderCalendar();
		}

		function selectEvent(event) {
			selectedEvent = event;
			document.getElementById('createdBy').value = event.createdBy;
			document.getElementById('title').value = event.title;
			document.getElementById('date').value = event.date;
			document.getElementById('startTime').value = event.startTime || '';
			document.getElementById('endTime').value = event.endTime || '';

			const memoText = event.memo || '';
			const imageStart = memoText.indexOf('data:image/');
			if (imageStart !== -1) {
				currentImageData = memoText.substring(imageStart);
				const displayMemo = memoText.substring(0, imageStart).trim();
				document.getElementById('memo').value = displayMemo;

				const img = document.createElement('img');
				img.src = currentImageData;
				img.style.maxWidth = '150px';
				img.style.borderRadius = '5px';
				img.style.marginTop = '10px';
				document.getElementById('imagePreview').innerHTML = '';
				document.getElementById('imagePreview').appendChild(img);
			} else {
				currentImageData = null;
				document.getElementById('memo').value = memoText;
				document.getElementById('imagePreview').innerHTML = '';
			}

			document.querySelectorAll('[data-event-id]').forEach(el => {
				el.classList.remove('selected');
			});
			document.querySelectorAll('[data-event-id="' + event.id + '"]').forEach(el => {
				el.classList.add('selected');
			});

			updateForm();
		}

		function updateForm() {
			const isEdit = selectedEvent !== null;
			document.getElementById('formTitle').textContent = isEdit ? '予定を編集' : '新しい予定';
			document.getElementById('submitBtn').textContent = isEdit ? '更新' : '追加';
			document.getElementById('deleteBtn').style.display = isEdit ? 'block' : 'none';
			document.getElementById('cancelBtn').style.display = isEdit ? 'block' : 'none';
			clearMessages();
		}

		let currentImageData = null;

		document.getElementById('memoImage').addEventListener('change', function(e) {
			const file = e.target.files[0];
			if (!file) {
				currentImageData = null;
				document.getElementById('imagePreview').innerHTML = '';
				return;
			}

			const reader = new FileReader();
			reader.onload = function(event) {
				currentImageData = event.target.result;
				const img = document.createElement('img');
				img.src = currentImageData;
				img.style.maxWidth = '150px';
				img.style.borderRadius = '5px';
				img.style.marginTop = '10px';
				document.getElementById('imagePreview').innerHTML = '';
				document.getElementById('imagePreview').appendChild(img);
			};
			reader.readAsDataURL(file);
		});

		document.getElementById('eventForm').addEventListener('submit', async (e) => {
			e.preventDefault();
			clearMessages();

			const createdBy = document.getElementById('createdBy').value;
			const title = document.getElementById('title').value;
			const date = document.getElementById('date').value;
			const startTime = document.getElementById('startTime').value;
			const endTime = document.getElementById('endTime').value;
			let memo = document.getElementById('memo').value;

			if (currentImageData) {
				memo = (memo ? memo + ' ' : '') + currentImageData;
			}

			if (!createdBy || !title || !date) {
				showError('担当者・予定名・日付を入力してください');
				return;
			}

			document.getElementById('submitBtn').disabled = true;

			try {
				if (selectedEvent) {
					const res = await fetch('/api/events/' + selectedEvent.id, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ title, date, startTime, endTime, memo })
					});
					if (!res.ok) throw new Error('更新失敗');
					showSuccess('予定を更新しました');
				} else {
					const res = await fetch('/api/events', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ title, date, startTime, endTime, memo, createdBy })
					});
					if (!res.ok) throw new Error('作成失敗');
					showSuccess('予定を追加しました');
				}

				document.getElementById('createdBy').value = '';
				document.getElementById('title').value = '';
				document.getElementById('startTime').value = '';
				document.getElementById('endTime').value = '';
				document.getElementById('memo').value = '';
				document.getElementById('memoImage').value = '';
				document.getElementById('imagePreview').innerHTML = '';
				currentImageData = null;
				selectedEvent = null;
				updateForm();
				renderCalendar();
			} catch (err) {
				showError(err.message);
			} finally {
				document.getElementById('submitBtn').disabled = false;
			}
		});

		document.getElementById('deleteBtn').addEventListener('click', async () => {
			if (!selectedEvent) return;
			if (!confirm('この予定を削除してもよろしいですか？')) return;

			try {
				const res = await fetch('/api/events/' + selectedEvent.id, { method: 'DELETE' });
				if (!res.ok) throw new Error('削除失敗');
				showSuccess('予定を削除しました');
				document.getElementById('createdBy').value = '';
				document.getElementById('title').value = '';
				document.getElementById('startTime').value = '';
				document.getElementById('endTime').value = '';
				document.getElementById('memo').value = '';
				document.getElementById('memoImage').value = '';
				document.getElementById('imagePreview').innerHTML = '';
				currentImageData = null;
				selectedEvent = null;
				updateForm();
				renderCalendar();
			} catch (err) {
				showError(err.message);
			}
		});

		document.getElementById('cancelBtn').addEventListener('click', () => {
			document.getElementById('createdBy').value = '';
			document.getElementById('title').value = '';
			document.getElementById('startTime').value = '';
			document.getElementById('endTime').value = '';
			document.getElementById('memo').value = '';
			document.getElementById('memoImage').value = '';
			document.getElementById('imagePreview').innerHTML = '';
			currentImageData = null;
			selectedEvent = null;
			updateForm();
		});

		function showError(msg) {
			const el = document.getElementById('formError');
			el.textContent = msg;
			el.style.display = 'block';
		}

		function showSuccess(msg) {
			const el = document.getElementById('formSuccess');
			el.textContent = msg;
			el.style.display = 'block';
			setTimeout(() => el.style.display = 'none', 3000);
		}

		function clearMessages() {
			document.getElementById('formError').style.display = 'none';
			document.getElementById('formSuccess').style.display = 'none';
		}

		async function loadAndSetup() {
			await renderCalendar();
		}

		if (isAuth()) {
			showApp();
			loadAndSetup();
			setInterval(loadAndSetup, 30000);
		} else {
			showAuth();
		}
	</script>
</body>
</html>`,
		{
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
			},
		}
	);
}

// Main handler
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// API routes
		if (url.pathname.startsWith('/api/')) {
			return handleApi(request, env);
		}

		// Serve HTML UI for all other routes
		return getHtmlResponse();
	},
};
