# -*- coding: utf-8 -*-
"""
生成答辩演示文稿（PPTX）与 PDF 版
运行：python scripts/build-slides.py
输出：docs/CineMax-答辩PPT.pptx / docs/CineMax-答辩PPT.pdf
"""
import os

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'docs')
os.makedirs(OUT_DIR, exist_ok=True)

# ---------------- 配色 ----------------
BG = '0B0D12'
PANEL = '151924'
BRAND = 'FF3D5E'
AMBER = 'FFB347'
CYAN = '5AD7FF'
TEXT = 'F3F5F9'
MUTED = '98A0B3'

SLIDES = [
    {
        'kicker': 'WEB 程序设计 · 期末小组项目',
        'title': 'CineMax 在线电影购票系统',
        'sub': '项目 13 · 选座购票 / 电子票 / 退改签 / 数据看板',
        'bullets': [
            '技术栈：HTML5 + CSS3 + 原生 JavaScript（DOM / BOM）+ Express + SQLite',
            '覆盖题目全部 15 项功能要求，前后端 + 数据库完整闭环',
            '小组编号：第 __ 组　　汇报人：________　　日期：____ 年 __ 月',
        ],
        'cover': True,
    },
    {
        'kicker': '01 项目背景',
        'title': '为什么做在线购票系统',
        'sub': '从“排队买票”到“手机选座、扫码取票”',
        'bullets': [
            '用户痛点：场次信息分散、现场排队、好座位先到先得、退改签流程不透明',
            '业务价值：把「找片 → 选场 → 选座 → 支付 → 取票 → 售后」收敛到一个页面闭环',
            '课程要求：不少于 15 个功能、完整 CRUD、前后端分离、数据库关联设计',
            '项目目标：做出一个真实可用、视觉现代的影院购票系统，而不是功能演示壳',
        ],
    },
    {
        'kicker': '02 功能总览',
        'title': '15 项要求逐条落地',
        'sub': '前台 8 大模块 + 后台 7 大模块',
        'bullets': [
            '前台：注册登录、热映/待映列表、搜索与筛选、影片详情、选座锁座、支付模拟、我的票夹、电子票二维码',
            '前台增强：退票 / 改签、影评评分、收藏想看、搜索历史、轮播广告、开场倒计时与桌面提醒',
            '后台：数据看板、影片管理、影院影厅、场次排片、订单管理、评论审核、轮播配置',
            '通用能力：JWT 鉴权、角色权限、统一响应、分页、错误处理、404 兜底、响应式布局',
        ],
    },
    {
        'kicker': '03 系统架构',
        'title': '前后端分离的三层结构',
        'sub': '原生多页面应用 + RESTful API + 关系型数据库',
        'bullets': [
            '表现层：6 个 HTML 页面 + 6 套 CSS + 原生 JS 命名空间（Auth / API / UI / Utils），无框架无构建',
            '接口层：Express 8 个路由模块，统一 { success, message, data }，Bearer Token 鉴权，管理员二次校验',
            '数据层：SQLite（node:sqlite）14 张表 + 1 视图，外键、唯一索引、事务封装，WAL 模式',
            '运行环境：Node.js ≥ 22.5，静态资源由 Express 托管，一条命令即可本地运行',
        ],
    },
    {
        'kicker': '04 数据库设计',
        'title': '14 张关联表支撑完整业务',
        'sub': 'users / movies / cinemas / halls / seats / showtimes / orders / tickets …',
        'bullets': [
            '主链路：users → orders → tickets → seats → halls → cinemas；orders → showtimes → movies',
            '防超卖：部分唯一索引 (showtime_id, seat_id) WHERE status IN (held, valid)',
            '一致性：下单、支付、退票、改签全部使用事务，并写入 order_logs 审计日志',
            '统计口径：v_paid_orders 视图统一票房、上座率、TOP 影片等看板查询',
        ],
    },
    {
        'kicker': '05 技术难点一',
        'title': '选座锁座与并发防超卖',
        'sub': '15 分钟锁座 + 唯一索引 + 事务三层保障',
        'bullets': [
            '座位图按排/列动态渲染，过道自动留白，区分普通座 / VIP 座 / 情侣座',
            '三态展示：可选、已售、他人锁定（我的锁定高亮），30 秒自动刷新座位状态',
            '锁座 15 分钟，超时自动释放；未支付订单到期自动关闭，避免座位长期占用',
            '并发下单时由数据库唯一索引兜底，冲突返回 409，前端精准提示“座位已被占用”',
        ],
    },
    {
        'kicker': '06 技术难点二',
        'title': '支付、电子票与退改签',
        'sub': '模拟支付 + 服务端二维码 + 规则化售后',
        'bullets': [
            '支付模拟：支付宝 / 微信 / 银行卡三种方式，支付后生成取票码与服务端二维码（qrcode → dataURL）',
            '电子票：二维码、取票码、影院影厅、座位与金额，支持浏览器打印（window.print）',
            '退票：开场前 2 小时可退，收取 5% 手续费，座位立即释放',
            '改签：仅限同影片其他场次，重新选等量座位，多退少补差价，旧票置为 changed',
        ],
    },
    {
        'kicker': '07 前台体验',
        'title': '影院级视觉与流畅交互',
        'sub': '深色主题 + 原创 SVG 素材 + 细节动画',
        'bullets': [
            '设计系统：CSS 变量统一色板与圆角，票根式品牌视觉，深色影院氛围',
            '首页：Hero 轮播（自动播放 / 箭头 / 圆点 / 悬停暂停）、票房榜、即将上映倒计时',
            '交互细节：骨架屏、Toast、弹窗动画、座位选中反馈、开场 10 分钟红色提醒 + Notification',
            'BOM 实践：localStorage 记住登录与搜索历史，history.replaceState 管理后台路由',
        ],
    },
    {
        'kicker': '08 管理后台',
        'title': '数据看板与全模块 CRUD',
        'sub': '原生 Canvas 手绘图表，无第三方图表库',
        'bullets': [
            '看板：今日/累计票房、用户数、上座率 4 项 KPI，近 14 天票房折线（渐变面积 + 入场动画）',
            '图表：影院票房占比环形图、影片 TOP 6 横向柱状图，全部 Canvas 手写并做 DPR 适配',
            '管理：影片（含演职人员动态行）、影院影厅（自动生成座位）、场次排片、订单、评论、轮播',
            '安全：所有管理接口 adminRequired 校验，普通用户访问返回 403',
        ],
    },
    {
        'kicker': '09 知识点覆盖',
        'title': '课程知识点全覆盖',
        'sub': 'HTML / CSS / JS / DOM / BOM / 数据库 / 前后端 / 动态效果',
        'bullets': [
            'HTML5：语义化结构、表单、表格、SVG；CSS3：Grid/Flex、媒体查询、动画、变量、打印样式',
            'JavaScript：模块化命名空间、async/await + fetch、异常处理、数组对象操作',
            'DOM：动态节点、事件委托、表单校验；BOM：localStorage、history、定时器、Notification、print',
            '数据库：14 表关联、外键、唯一索引、事务、分页聚合；后端：RESTful、JWT、CORS、统一错误处理',
        ],
    },
    {
        'kicker': '10 测试与部署',
        'title': '质量保障与上线方案',
        'sub': '33 项接口测试 + 前端全链路实测',
        'bullets': [
            '接口测试：npm run test:api 覆盖鉴权、选座、支付、二维码、改签、退票、评论、收藏、后台 CRUD',
            '前端实测：首页 → 详情 → 选座 → 支付 → 电子票 → 我的票夹 → 后台看板，核心链路全部通过',
            '部署：提供 Dockerfile 与 Render 蓝图，SQLite 挂载持久化卷；也支持云服务器 + Nginx',
            '运维：/api/health 健康检查、访问日志、.env 环境变量管理、数据库一键重建脚本',
        ],
    },
    {
        'kicker': '11 团队分工',
        'title': '分工明确，协同交付',
        'sub': '详见 docs/分工说明.md',
        'bullets': [
            '成员 A：需求拆解、数据库设计、后端鉴权与影片/影院接口',
            '成员 B：选座锁座、订单支付、退改签等核心交易接口',
            '成员 C：前台首页、影片详情、选座支付页与响应式样式',
            '成员 D：我的票夹、管理后台与 Canvas 数据看板',
            '成员 E：视觉素材、测试用例、部署上线、PPT 与录屏',
        ],
    },
]

# ============================================================
# 一、生成 PPTX
# ============================================================
def build_pptx():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank = prs.slide_layouts[6]

    for idx, s in enumerate(SLIDES):
        slide = prs.slides.add_slide(blank)

        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
        bg.fill.solid()
        bg.fill.fore_color.rgb = RGBColor.from_string(BG)
        bg.line.fill.background()
        bg.shadow.inherit = False

        # 顶部品牌
        kicker = slide.shapes.add_textbox(Inches(0.85), Inches(0.55), Inches(10), Inches(0.4))
        p = kicker.text_frame.paragraphs[0]
        r = p.add_run()
        r.text = s['kicker']
        r.font.size = Pt(12)
        r.font.bold = True
        r.font.color.rgb = RGBColor.from_string(BRAND)
        r.font.name = 'Microsoft YaHei'

        # 封面
        if s.get('cover'):
            t = slide.shapes.add_textbox(Inches(0.85), Inches(2.05), Inches(11.6), Inches(1.3))
            tf = t.text_frame
            tf.word_wrap = True
            r = tf.paragraphs[0].add_run()
            r.text = s['title']
            r.font.size = Pt(46)
            r.font.bold = True
            r.font.color.rgb = RGBColor.from_string(TEXT)
            r.font.name = 'Microsoft YaHei'

            sub = slide.shapes.add_textbox(Inches(0.85), Inches(3.35), Inches(11.6), Inches(0.6))
            r = sub.text_frame.paragraphs[0].add_run()
            r.text = s['sub']
            r.font.size = Pt(19)
            r.font.color.rgb = RGBColor.from_string(AMBER)
            r.font.name = 'Microsoft YaHei'

            line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.85), Inches(4.15), Inches(1.6), Inches(0.06))
            line.fill.solid()
            line.fill.fore_color.rgb = RGBColor.from_string(BRAND)
            line.line.fill.background()
            line.shadow.inherit = False

            box = slide.shapes.add_textbox(Inches(0.85), Inches(4.55), Inches(11.4), Inches(2))
            tf = box.text_frame
            tf.word_wrap = True
            for i, b in enumerate(s['bullets']):
                p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
                p.space_after = Pt(10)
                r = p.add_run()
                r.text = b
                r.font.size = Pt(14)
                r.font.color.rgb = RGBColor.from_string(MUTED)
                r.font.name = 'Microsoft YaHei'
        else:
            t = slide.shapes.add_textbox(Inches(0.85), Inches(1.05), Inches(11.6), Inches(0.9))
            r = t.text_frame.paragraphs[0].add_run()
            r.text = s['title']
            r.font.size = Pt(36)
            r.font.bold = True
            r.font.color.rgb = RGBColor.from_string(TEXT)
            r.font.name = 'Microsoft YaHei'

            sub = slide.shapes.add_textbox(Inches(0.85), Inches(1.95), Inches(11.6), Inches(0.5))
            r = sub.text_frame.paragraphs[0].add_run()
            r.text = s['sub']
            r.font.size = Pt(15)
            r.font.color.rgb = RGBColor.from_string(AMBER)
            r.font.name = 'Microsoft YaHei'

            line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.85), Inches(2.55), Inches(1.1), Inches(0.05))
            line.fill.solid()
            line.fill.fore_color.rgb = RGBColor.from_string(BRAND)
            line.line.fill.background()
            line.shadow.inherit = False

            card = slide.shapes.add_shape(
                MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.85), Inches(2.95), Inches(11.6), Inches(3.75)
            )
            card.fill.solid()
            card.fill.fore_color.rgb = RGBColor.from_string(PANEL)
            card.line.color.rgb = RGBColor.from_string('2A3042')
            card.shadow.inherit = False
            card.adjustments[0] = 0.06

            box = slide.shapes.add_textbox(Inches(1.25), Inches(3.3), Inches(10.8), Inches(3.1))
            tf = box.text_frame
            tf.word_wrap = True
            for i, b in enumerate(s['bullets']):
                p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
                p.space_after = Pt(14)
                r = p.add_run()
                r.text = '·  ' + b
                r.font.size = Pt(16)
                r.font.color.rgb = RGBColor.from_string(TEXT if i % 2 == 0 else 'D6DBE6')
                r.font.name = 'Microsoft YaHei'

        # 页码
        num = slide.shapes.add_textbox(Inches(11.9), Inches(6.85), Inches(1), Inches(0.4))
        p = num.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.RIGHT
        r = p.add_run()
        r.text = f'{idx + 1:02d}'
        r.font.size = Pt(11)
        r.font.color.rgb = RGBColor.from_string('5A6274')
        r.font.name = 'Microsoft YaHei'

    path = os.path.join(OUT_DIR, 'CineMax-答辩PPT.pptx')
    prs.save(path)
    return path


# ============================================================
# 二、生成 PDF（同版式）
# ============================================================
def register_cn_font():
    candidates = [
        ('MSYH', r'C:\Windows\Fonts\msyh.ttc', 0),
        ('MSYH', r'C:\Windows\Fonts\msyhbd.ttc', 0),
        ('SIMHEI', r'C:\Windows\Fonts\simhei.ttf', None),
        ('SIMSUN', r'C:\Windows\Fonts\simsun.ttc', 0),
    ]
    for name, path, index in candidates:
        if not os.path.exists(path):
            continue
        try:
            if index is None:
                pdfmetrics.registerFont(TTFont(name, path))
            else:
                pdfmetrics.registerFont(TTFont(name, path, subfontIndex=index))
            return name
        except Exception:
            continue
    return 'Helvetica'


def wrap_cn(text, font, size, max_width):
    lines, cur = [], ''
    for ch in text:
        if pdfmetrics.stringWidth(cur + ch, font, size) > max_width:
            lines.append(cur)
            cur = ch
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines


def build_pdf():
    font = register_cn_font()
    path = os.path.join(OUT_DIR, 'CineMax-答辩PPT.pdf')
    W, H = 960, 540
    c = canvas.Canvas(path, pagesize=(W, H))
    c.setTitle('CineMax 在线电影购票系统 · 答辩演示')

    for idx, s in enumerate(SLIDES):
        c.setFillColor(HexColor('#' + BG))
        c.rect(0, 0, W, H, stroke=0, fill=1)

        c.setFillColor(HexColor('#' + BRAND))
        c.setFont(font, 12)
        c.drawString(62, H - 52, s['kicker'])

        if s.get('cover'):
            c.setFillColor(HexColor('#' + TEXT))
            c.setFont(font, 40)
            c.drawString(62, H - 190, s['title'])

            c.setFillColor(HexColor('#' + AMBER))
            c.setFont(font, 17)
            c.drawString(62, H - 232, s['sub'])

            c.setFillColor(HexColor('#' + BRAND))
            c.rect(62, H - 262, 118, 4, stroke=0, fill=1)

            y = H - 320
            for b in s['bullets']:
                c.setFillColor(HexColor('#8E96A8'))
                c.setFont(font, 13)
                for line in wrap_cn(b, font, 13, 800):
                    c.drawString(62, y, line)
                    y -= 24
                y -= 8
        else:
            c.setFillColor(HexColor('#' + TEXT))
            c.setFont(font, 30)
            c.drawString(62, H - 130, s['title'])

            c.setFillColor(HexColor('#' + AMBER))
            c.setFont(font, 13)
            c.drawString(62, H - 160, s['sub'])

            c.setFillColor(HexColor('#' + BRAND))
            c.rect(62, H - 182, 80, 3.5, stroke=0, fill=1)

            c.setFillColor(HexColor('#' + PANEL))
            c.setStrokeColor(HexColor('#2A3042'))
            c.roundRect(62, 62, W - 124, H - 270, 14, stroke=1, fill=1)

            y = H - 245
            for b in s['bullets']:
                c.setFillColor(HexColor('#' + BRAND))
                c.setFont(font, 14)
                c.drawString(88, y + 1, '·')
                c.setFillColor(HexColor('#E6EAF2'))
                c.setFont(font, 13.5)
                for line in wrap_cn(b, font, 13.5, 720):
                    c.drawString(104, y, line)
                    y -= 23
                y -= 14

        c.setFillColor(HexColor('#5A6274'))
        c.setFont(font, 10)
        c.drawRightString(W - 62, 32, f'{idx + 1:02d}')
        c.showPage()

    c.save()
    return path


if __name__ == '__main__':
    print('PPTX ->', build_pptx())
    print('PDF  ->', build_pdf())
