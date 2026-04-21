interface Env {
	DB: D1Database;
}

interface CalendarEvent {
	id: string;
	title: string;
	date: string;
	startTime?: string;
	endTime?: string;
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
					createdBy: string;
				}>();
				const { title, date, startTime, endTime, createdBy } = body;

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
						'INSERT INTO events (id, title, date, startTime, endTime, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
					)
					.bind(id, title, date, startTime || null, endTime || null, createdBy, now, now)
					.run();

				return new Response(
					JSON.stringify({
						id,
						title,
						date,
						startTime,
						endTime,
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
			}>();

			const now = new Date().toISOString();

			await env.DB
				.prepare(
					'UPDATE events SET title = COALESCE(?, title), date = COALESCE(?, date), startTime = ?, endTime = ?, updatedAt = ? WHERE id = ?'
				)
				.bind(body.title, body.date, body.startTime || null, body.endTime || null, now, id)
				.run();

			return new Response(JSON.stringify({ success: true }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		if (path.startsWith('/api/events/') && request.method === 'DELETE') {
			const id = path.split('/')[3];

			await env.DB.prepare('DELETE FROM events WHERE id = ?').bind(id).run();

			return new Response(JSON.stringify({ success: true }), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
		.day {
			aspect-ratio: 1;
			border: 1px solid #ddd;
			border-radius: 5px;
			padding: 8px;
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
		.day-num {
			font-weight: bold;
			font-size: 0.9em;
			color: #333;
			margin-bottom: 4px;
		}
		.day-events {
			font-size: 0.7em;
		}
		.event-badge {
			background: #667eea;
			color: white;
			padding: 2px 4px;
			border-radius: 2px;
			margin-bottom: 2px;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.form-section {
			background: white;
			border-radius: 10px;
			padding: 20px;
			box-shadow: 0 10px 30px rgba(0,0,0,0.2);
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
		input, textarea {
			width: 100%;
			padding: 8px;
			border: 1px solid #ddd;
			border-radius: 5px;
			font-family: inherit;
		}
		input:focus, textarea:focus {
			outline: none;
			border-color: #667eea;
			box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
		}
		button.submit {
			width: 100%;
			padding: 10px;
			background: #667eea;
			color: white;
			border: none;
			border-radius: 5px;
			font-weight: bold;
			cursor: pointer;
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
	<div class="container">
		<h1>📅 家族の予定</h1>

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
					<button type="submit" class="submit" id="submitBtn">追加</button>
					<button type="button" class="delete" id="deleteBtn" style="display: none;">削除</button>
					<button type="button" class="delete" style="background: #999; display: none;" id="cancelBtn">キャンセル</button>
					<div id="formError" class="error"></div>
					<div id="formSuccess" class="success"></div>
				</form>
			</div>
		</div>
	</div>

	<script>
		let currentDate = new Date();
		let selectedEvent = null;
		const createdBy = 'user';

		function formatDate(d) {
			return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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
				day.className = 'day' + (d.getMonth() !== month ? ' other-month' : '');

				const dateStr = formatDate(d);
				const dayEvents = events.filter(e => e.date === dateStr);

				let html = '<div class="day-num">' + d.getDate() + '</div>';
				html += '<div class="day-events">';
				dayEvents.slice(0, 2).forEach(e => {
					html += '<div class="event-badge" onclick="selectEvent(' + JSON.stringify(e) + ')">' + e.title + '</div>';
				});
				if (dayEvents.length > 2) {
					html += '<div class="event-badge">+' + (dayEvents.length - 2) + '</div>';
				}
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
			document.getElementById('title').value = event.title;
			document.getElementById('date').value = event.date;
			document.getElementById('startTime').value = event.startTime || '';
			document.getElementById('endTime').value = event.endTime || '';
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

		document.getElementById('eventForm').addEventListener('submit', async (e) => {
			e.preventDefault();
			clearMessages();

			const title = document.getElementById('title').value;
			const date = document.getElementById('date').value;
			const startTime = document.getElementById('startTime').value;
			const endTime = document.getElementById('endTime').value;

			if (!title || !date) {
				showError('予定名と日付を入力してください');
				return;
			}

			document.getElementById('submitBtn').disabled = true;

			try {
				if (selectedEvent) {
					// Update
					const res = await fetch('/api/events/' + selectedEvent.id, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ title, date, startTime, endTime })
					});
					if (!res.ok) throw new Error('更新失敗');
					showSuccess('予定を更新しました');
				} else {
					// Create
					const res = await fetch('/api/events', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ title, date, startTime, endTime, createdBy })
					});
					if (!res.ok) throw new Error('作成失敗');
					showSuccess('予定を追加しました');
				}

				document.getElementById('title').value = '';
				document.getElementById('startTime').value = '';
				document.getElementById('endTime').value = '';
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
				document.getElementById('title').value = '';
				document.getElementById('startTime').value = '';
				document.getElementById('endTime').value = '';
				selectedEvent = null;
				updateForm();
				renderCalendar();
			} catch (err) {
				showError(err.message);
			}
		});

		document.getElementById('cancelBtn').addEventListener('click', () => {
			document.getElementById('title').value = '';
			document.getElementById('startTime').value = '';
			document.getElementById('endTime').value = '';
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

		// Initialize
		document.getElementById('date').valueAsDate = new Date();
		updateForm();
		renderCalendar();
		setInterval(renderCalendar, 30000);
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
