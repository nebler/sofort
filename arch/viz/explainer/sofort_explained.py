"""Sofort, explained: a 3Blue1Brown-style walkthrough built with Manim Community Edition.

Render (from this directory, using the local venv):
    /tmp/sofort-manim-venv/bin/manim -qh --save_sections sofort_explained.py SofortExplained

Numbers on screen come from arch/jitk/shard/RESULTS-R6.md, arch/research/perf/SUMMARY.md,
arch/research/perf/linux-ledger/RESULTS.md and arch/research/native-census/RESULTS.md.
Nested-KVM numbers are labelled as such; nothing here is a metal benchmark.
"""

from manim import *

# Palette, close to 3b1b defaults.
HW = GREY_B
KERNEL = BLUE_C
PROG = YELLOW
HOST = TEAL_C
GOOD = GREEN_C
BAD = RED_C
PLAN = GOLD_C
DIM = GREY_C


def label_box(text, color, width=3.2, height=0.9, font_size=28, fill=0.18, text_color=WHITE):
    rect = RoundedRectangle(corner_radius=0.15, width=width, height=height, color=color)
    rect.set_fill(color, opacity=fill)
    t = Text(text, font_size=font_size, color=text_color)
    if t.width > width - 0.3:
        t.scale_to_fit_width(width - 0.3)
    t.move_to(rect)
    return VGroup(rect, t)


def caption(text, font_size=30, color=WHITE):
    t = Text(text, font_size=font_size, color=color)
    if t.width > 13:
        t.scale_to_fit_width(13)
    return t.to_edge(DOWN, buff=0.45)


def dot_grid(n, cols, size=0.11, gap=0.05, color=DIM):
    squares = VGroup(*[Square(side_length=size, stroke_width=0).set_fill(color, 1) for _ in range(n)])
    squares.arrange_in_grid(cols=cols, buff=gap)
    return squares


def status_tag(built=True):
    return Text("built" if built else "planned", font_size=18, color=GOOD if built else PLAN)


class SofortExplained(Scene):
    def construct(self):
        self.camera.background_color = "#0f0f14"
        parts = [
            self.part_title,
            self.part_layers,
            self.part_problem,
            self.part_unikernel,
            self.part_overhead,
            self.part_one_door,
            self.part_grow,
            self.part_snapshots,
            self.part_architecture,
            self.part_wait,
            self.part_where_we_are,
            self.part_next,
        ]
        for part in parts:
            self.next_section(part.__name__.replace("part_", ""))
            part()
            self.clear_all()

    # ------------------------------------------------------------------ helpers
    def clear_all(self):
        if self.mobjects:
            self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.8)
        self.wait(0.2)

    # ------------------------------------------------------------------ 1
    def part_title(self):
        title = Text("Sofort", font_size=110, color=PROG)
        sub = Text("a computer for every task", font_size=40, color=GREY_B).next_to(title, DOWN, buff=0.4)
        self.play(Write(title), run_time=1.5)
        self.play(FadeIn(sub, shift=UP * 0.3))
        self.wait(1.5)
        q = Text("But first: what is a computer, really?", font_size=36).to_edge(DOWN, buff=1)
        self.play(FadeIn(q))
        self.wait(2)

    # ------------------------------------------------------------------ 2
    def part_layers(self):
        hw = label_box("Hardware: CPU, memory, devices", HW, width=7, height=1)
        kern = label_box("Kernel", KERNEL, width=7, height=1)
        prog = label_box("Your program", PROG, width=3.4, height=1, text_color=BLACK, fill=0.9)
        stack = VGroup(prog, kern, hw).arrange(DOWN, buff=0.35).shift(UP * 0.2)
        prog.shift(UP * 0.9)

        self.play(FadeIn(hw, shift=UP))
        self.play(FadeIn(kern, shift=UP))
        self.play(FadeIn(prog, shift=UP))
        cap = caption("A program never touches the hardware directly.")
        self.play(Write(cap))
        self.wait(1.5)

        calls = ["read", "write", "open", "clock"]
        arrows = VGroup()
        for i, name in enumerate(calls):
            x = -2.4 + i * 1.6
            start = prog.get_bottom() + RIGHT * (x * 0.55)
            a = Arrow(start + DOWN * 0.02, kern.get_top() + RIGHT * x + UP * 0.02, buff=0.05,
                      color=PROG, stroke_width=4, max_tip_length_to_length_ratio=0.25)
            lbl = Text(name, font_size=20, color=PROG).next_to(a.get_center(), RIGHT, buff=0.12)
            arrows.add(VGroup(a, lbl))
        cap2 = caption("It asks the kernel. Each request is a system call (a \"syscall\").")
        self.play(LaggedStart(*[GrowArrow(a[0]) for a in arrows], lag_ratio=0.2),
                  LaggedStart(*[FadeIn(a[1]) for a in arrows], lag_ratio=0.2),
                  ReplacementTransform(cap, cap2))
        self.wait(2)

        kern_note = Text("Kernel: the referee for memory, files, network, time", font_size=26)
        kern_note.scale_to_fit_width(6.4).move_to(kern[1])
        self.play(ReplacementTransform(kern[1], kern_note))
        self.wait(2)

        # How big is Linux, and how much of it does one program use?
        self.play(FadeOut(VGroup(stack, arrows, kern_note)), FadeOut(cap2))
        grid = dot_grid(450, cols=30, size=0.13, gap=0.06, color=KERNEL).shift(UP * 0.4)
        head = Text("Linux: about 450 kinds of syscall, tens of millions of lines of code",
                    font_size=28).to_edge(UP, buff=0.5)
        self.play(FadeIn(head), LaggedStart(*[FadeIn(s) for s in grid], lag_ratio=0.002, run_time=2))
        used = [3, 17, 29, 56, 63, 64, 80, 96, 113, 134, 135, 172, 214, 215, 222, 226, 260, 278, 291, 302]
        cap3 = caption("A small program uses maybe 10 to 30 of them.")
        self.play(*[grid[i].animate.set_fill(PROG, 1).scale(1.4) for i in used], Write(cap3))
        self.wait(2.5)
        cap4 = caption("Everything else is still there: more code to trust, more doors to attack.", color=GREY_B)
        self.play(ReplacementTransform(cap3, cap4))
        self.wait(2.5)

    # ------------------------------------------------------------------ 3
    def part_problem(self):
        head = Text("The new problem: agents write code nobody has read", font_size=34).to_edge(UP, buff=0.5)
        self.play(Write(head))
        self.wait(1)

        def column(title, body, verdict, vcolor):
            t = Text(title, font_size=26, color=WHITE)
            v = Text(verdict, font_size=20, color=vcolor)
            g = VGroup(t, body, v).arrange(DOWN, buff=0.35)
            return g

        # 1. In your process
        app = RoundedRectangle(corner_radius=0.1, width=3, height=2.2, color=HOST).set_fill(HOST, 0.12)
        app_lbl = Text("your app + secrets", font_size=18, color=HOST).next_to(app.get_top(), DOWN, buff=0.12)
        ag = label_box("agent code", PROG, width=1.8, height=0.6, font_size=18, text_color=BLACK, fill=0.9).move_to(app).shift(DOWN * 0.25)
        c1 = column("Run it in your process", VGroup(app, app_lbl, ag), "nothing in between", BAD)

        # 2. Container
        shared_k = label_box("one shared Linux kernel", KERNEL, width=3, height=0.6, font_size=18)
        boxes = VGroup(*[label_box("code", PROG, width=0.85, height=0.55, font_size=16, text_color=BLACK, fill=0.9)
                         for _ in range(3)]).arrange(RIGHT, buff=0.12)
        cont = VGroup(boxes, shared_k).arrange(DOWN, buff=0.25)
        c2 = column("Container", cont, "shares all ~450 doors", PLAN)

        # 3. Virtual machine
        wall = Rectangle(width=3, height=2.2, color=HW, stroke_width=8)
        vk = label_box("full Linux kernel", KERNEL, width=2.4, height=0.6, font_size=18)
        vp = label_box("code", PROG, width=1.2, height=0.5, font_size=16, text_color=BLACK, fill=0.9)
        inner = VGroup(vp, vk).arrange(DOWN, buff=0.25).move_to(wall)
        c3 = column("Virtual machine", VGroup(wall, inner), "hardware wall, but heavy", PLAN)

        cols = VGroup(c1, c2, c3).arrange(RIGHT, buff=0.9).shift(DOWN * 0.2)
        for c in cols:
            self.play(FadeIn(c, shift=UP * 0.2), run_time=0.9)
            self.wait(1.2)
        cap = caption("A VM wall is made by the CPU itself. But each VM carries a whole operating system.")
        self.play(Write(cap))
        self.play(Indicate(c3[0][1], color=PROG))
        self.wait(3)

    # ------------------------------------------------------------------ 4
    def part_unikernel(self):
        head = Text("The idea: a unikernel", font_size=40, color=PROG).to_edge(UP, buff=0.5)
        self.play(Write(head))
        wall = Rectangle(width=6, height=4.6, color=HW, stroke_width=10).shift(DOWN * 0.2)
        wall_lbl = Text("hardware VM wall", font_size=20, color=HW).next_to(wall, UP, buff=0.1).align_to(wall, LEFT)
        big = dot_grid(450, cols=30, size=0.1, gap=0.045, color=KERNEL).move_to(wall).shift(DOWN * 0.45)
        prog = label_box("program", PROG, width=1.8, height=0.55, font_size=20, text_color=BLACK, fill=0.9)
        prog.next_to(big, UP, buff=0.25)
        self.play(Create(wall), FadeIn(wall_lbl), FadeIn(big), FadeIn(prog))
        cap = caption("Keep the hardware wall. Throw away every part of the kernel this job does not need.")
        self.play(Write(cap))
        self.wait(1.5)

        small = dot_grid(24, cols=6, size=0.22, gap=0.08, color=PROG)
        small_box = SurroundingRectangle(small, color=KERNEL, buff=0.15, corner_radius=0.1)
        small_grp = VGroup(small_box, small).move_to(wall).shift(DOWN * 0.45)
        self.play(ReplacementTransform(big, small_grp), run_time=2)
        stats = VGroup(
            Text("jitk", font_size=34, color=KERNEL),
            Text("about 1,700 lines of Rust", font_size=24),
            Text("24 syscall slots", font_size=24),
            Text("runs unmodified static programs:", font_size=22, color=GREY_B),
            Text("QuickJS, Lua, jq, BusyBox …", font_size=22, color=GREY_B),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.18).next_to(wall, RIGHT, buff=0.5)
        cap2 = caption("Same hardware boundary, almost nothing inside to attack or to pay for.")
        self.play(FadeIn(stats, shift=LEFT * 0.3), ReplacementTransform(cap, cap2))
        self.wait(3.5)

    # ------------------------------------------------------------------ 5
    def part_overhead(self):
        head = Text("When does a tiny kernel actually matter?", font_size=34).to_edge(UP, buff=0.5)
        self.play(Write(head))

        def bar(work_w, over_w, title, y):
            over = Rectangle(width=over_w, height=0.7, color=KERNEL).set_fill(KERNEL, 0.7)
            work = Rectangle(width=work_w, height=0.7, color=PROG).set_fill(PROG, 0.85)
            row = VGroup(over, work).arrange(RIGHT, buff=0).move_to(UP * y)
            row.align_to(LEFT * 5.2, LEFT)
            t = Text(title, font_size=22).next_to(row, UP, buff=0.12).align_to(row, LEFT)
            return VGroup(row, t), over, work

        small, s_over, s_work = bar(0.3, 6.0, "small agent task: a few ms of glue code", 1.0)
        big, b_over, b_work = bar(9.4, 0.6, "coding workspace: compilers, node_modules, GBs", -1.2)
        legend = VGroup(
            VGroup(Square(0.25).set_fill(KERNEL, 0.7).set_stroke(width=0), Text("OS overhead", font_size=20)).arrange(RIGHT, buff=0.15),
            VGroup(Square(0.25).set_fill(PROG, 0.85).set_stroke(width=0), Text("actual work", font_size=20)).arrange(RIGHT, buff=0.15),
        ).arrange(RIGHT, buff=0.6).next_to(head, DOWN, buff=0.35)
        self.play(FadeIn(legend), FadeIn(small), FadeIn(big))
        self.wait(1.5)
        cap = caption("For small work, the operating system IS the cost. Shrink it and the cost collapses.")
        self.play(Write(cap), s_over.animate.stretch_to_fit_width(0.35).align_to(s_over, LEFT), run_time=2)
        self.play(s_work.animate.next_to(s_over, RIGHT, buff=0))
        self.wait(1.5)
        cap2 = caption("For a big workspace the kernel is a sliver. A tiny kernel barely helps there.", color=GREY_B)
        self.play(ReplacementTransform(cap, cap2), Indicate(b_over, color=WHITE))
        self.wait(2)
        cap3 = caption("Agent tool calls are the first kind: small, short, and there are millions of them.", color=PROG)
        self.play(ReplacementTransform(cap2, cap3))
        self.wait(3)

    # ------------------------------------------------------------------ 6
    def part_one_door(self):
        head = Text("One door in, one door out", font_size=36).to_edge(UP, buff=0.5)
        self.play(Write(head))
        wall = Rectangle(width=4.2, height=3.6, color=HW, stroke_width=10).shift(LEFT * 3.8 + DOWN * 0.3)
        k = label_box("jitk", KERNEL, width=3.2, height=0.7, font_size=24).move_to(wall).shift(DOWN * 0.9)
        p = label_box("agent's code", PROG, width=2.6, height=0.7, font_size=22, text_color=BLACK, fill=0.9).move_to(wall).shift(UP * 0.6)
        host = label_box("trusted host: policy + credentials", HOST, width=4.6, height=1.0, font_size=22).shift(RIGHT * 3.4 + UP * 0.4)
        tools = VGroup(*[label_box(t, HOST, width=1.5, height=0.55, font_size=18, fill=0.08)
                         for t in ["search", "GitHub", "database"]]).arrange(RIGHT, buff=0.2).next_to(host, DOWN, buff=0.5)
        self.play(Create(wall), FadeIn(k), FadeIn(p))
        self.play(FadeIn(host), FadeIn(tools))
        pipe = Arrow(wall.get_right() + UP * 0.4, host.get_left(), buff=0.1, color=PROG, stroke_width=6)
        pipe_lbl = Text("tool channel", font_size=20, color=PROG).next_to(pipe, UP, buff=0.08)
        self.play(GrowArrow(pipe), FadeIn(pipe_lbl))
        cap = caption("The guest's ONLY input/output is one channel to the host. No network. No host files.")
        self.play(Write(cap))
        for _ in range(2):
            d = Dot(color=PROG).move_to(pipe.get_start())
            self.play(MoveAlongPath(d, Line(pipe.get_start(), pipe.get_end())), run_time=0.8)
            self.play(Indicate(host, color=HOST, scale_factor=1.05), FadeOut(d), run_time=0.6)
        self.wait(1)
        net = Text("internet", font_size=22, color=BAD).next_to(wall, DOWN, buff=0.35)
        cross = Cross(net, stroke_color=BAD)
        self.play(FadeIn(net), Create(cross))
        cap2 = caption("Every effect is a request the host can check, log, approve, or refuse.", color=HOST)
        self.play(ReplacementTransform(cap, cap2))
        self.wait(2)

        self.play(*[FadeOut(m) for m in [wall, k, p, host, tools, pipe, pipe_lbl, net, cross]])
        circles = VGroup(
            Circle(radius=1.45, color=BLUE_C).set_fill(BLUE_C, 0.15),
            Circle(radius=1.45, color=PURPLE_B).set_fill(PURPLE_B, 0.15),
            Circle(radius=1.45, color=BAD).set_fill(BAD, 0.15),
        ).arrange(RIGHT, buff=-0.7).shift(DOWN * 0.1)
        labels = VGroup(
            Text("private data", font_size=20).move_to(circles[0]).shift(LEFT * 0.45),
            Text("untrusted input", font_size=20).move_to(circles[1]).shift(UP * 0.8),
            Text("talks to\nthe outside", font_size=20).move_to(circles[2]).shift(RIGHT * 0.45),
        )
        tri = Text("the \"lethal trifecta\" for agent leaks", font_size=26, color=GREY_B).next_to(circles, UP, buff=0.4)
        self.play(FadeIn(circles), FadeIn(labels), FadeIn(tri))
        self.wait(1.5)
        x = Cross(circles[2], stroke_color=BAD, stroke_width=8)
        cap3 = caption("Sofort removes the third circle by construction: the guest has no way out except tools.")
        self.play(Create(x), ReplacementTransform(cap2, cap3))
        self.wait(3)

    # ------------------------------------------------------------------ 7
    def part_grow(self):
        head = Text("How does a tiny kernel learn new tricks?", font_size=34).to_edge(UP, buff=0.5)
        self.play(Write(head))
        steps = [
            ("program hits a missing syscall", BAD),
            ("record what real Linux does", BLUE_C),
            ("an agent writes the handler", PROG),
            ("test it against Linux in fresh VMs", GOOD),
            ("ship it in a versioned kernel", KERNEL),
        ]
        nodes = VGroup()
        radius = 2.3
        for i, (txt, col) in enumerate(steps):
            ang = PI / 2 - i * TAU / len(steps)
            b = label_box(txt, col, width=3.4, height=0.75, font_size=19).move_to(
                np.array([radius * 1.55 * np.cos(ang), radius * np.sin(ang) - 0.35, 0]))
            nodes.add(b)
        arrows = VGroup(*[
            Arrow(nodes[i], nodes[(i + 1) % 5], buff=0.12, color=GREY_B, stroke_width=4)
            for i in range(5)
        ])
        for i in range(5):
            self.play(FadeIn(nodes[i], scale=0.9), run_time=0.6)
            self.play(Create(arrows[i]), run_time=0.4)
        cap = caption("The kernel grows offline, one tested syscall at a time. Nothing grows at runtime.")
        self.play(Write(cap))
        self.wait(3)

        self.play(FadeOut(nodes), FadeOut(arrows), FadeOut(cap))
        rows = [
            ("runs today, unmodified", "jq · Lua · MicroPython · BusyBox sed / awk / grep / sort / wc / tar", GOOD),
            ("one step away", "SQLite (read-only): needs fstat + pread64", PROG),
            ("medium", "ripgrep: wider loader, signals, memory protection", PLAN),
            ("Linux tier for now", "Go tools, ffmpeg, git, curl: threads, processes, network", BAD),
        ]
        table = VGroup()
        for i, (tag, body, col) in enumerate(rows):
            y = 0.9 - i * 0.75
            t = Text(tag, font_size=22, color=col)
            t.move_to([0, y, 0]).align_to([-3.0, 0, 0], RIGHT)
            b = Text(body, font_size=22)
            if b.width > 9.0:
                b.scale_to_fit_width(9.0)
            b.move_to([0, y, 0]).align_to([-2.7, 0, 0], LEFT)
            table.add(VGroup(t, b))
        table.shift(LEFT * 0.4)
        census = Text("Native tools census: 29 tools tested on the dev VM", font_size=26, color=GREY_B).next_to(head, DOWN, buff=0.35)
        self.play(FadeIn(census))
        self.play(LaggedStart(*[FadeIn(r, shift=RIGHT * 0.2) for r in table], lag_ratio=0.4))
        cap2 = caption("Real Linux tools, unchanged, in a hardware VM: the part V8 isolates and Wasm cannot do.", color=PROG)
        self.play(Write(cap2))
        self.wait(3.5)

    # ------------------------------------------------------------------ 8
    def part_snapshots(self):
        head = Text("Boot once. Copy forever.", font_size=38).to_edge(UP, buff=0.5)
        self.play(Write(head))
        boot = VGroup(
            label_box("boot jitk", KERNEL, width=2.2, height=0.6, font_size=20),
            label_box("start QuickJS", PROG, width=2.2, height=0.6, font_size=20, text_color=BLACK, fill=0.9),
            label_box("READY", GOOD, width=1.6, height=0.6, font_size=20),
        ).arrange(RIGHT, buff=0.5).shift(UP * 1.6)
        barrows = VGroup(*[Arrow(boot[i].get_right(), boot[i + 1].get_left(), buff=0.08, color=GREY_B) for i in range(2)])
        self.play(LaggedStart(FadeIn(boot[0]), GrowArrow(barrows[0]), FadeIn(boot[1]), GrowArrow(barrows[1]), FadeIn(boot[2]), lag_ratio=0.5))
        flash = Rectangle(width=16, height=9).set_fill(WHITE, 0.6).set_stroke(width=0)
        self.play(FadeIn(flash, run_time=0.1))
        self.play(FadeOut(flash, run_time=0.4))
        snap = label_box("snapshot: memory + CPU state at READY (read-only, shared)", BLUE_D, width=9.5, height=0.8, font_size=22, fill=0.35)
        snap.next_to(boot, DOWN, buff=0.6)
        self.play(FadeIn(snap, shift=DOWN * 0.2))
        cap = caption("One snapshot file is mapped into every VM, copy-on-write.")
        self.play(Write(cap))

        slots = VGroup()
        for i in range(8):
            frame = Rectangle(width=1.25, height=1.25, color=HW, stroke_width=3)
            shared = Rectangle(width=1.05, height=0.75).set_fill(BLUE_D, 0.35).set_stroke(width=0)
            shared.move_to(frame).shift(UP * 0.15)
            n = np.random.default_rng(i).integers(1, 4)
            priv = VGroup(*[Square(0.16).set_fill(PROG, 1).set_stroke(width=0) for _ in range(int(n))]).arrange(RIGHT, buff=0.04)
            priv.next_to(shared, DOWN, buff=0.08)
            slots.add(VGroup(frame, shared, priv))
        slots.arrange(RIGHT, buff=0.25).next_to(snap, DOWN, buff=0.55)
        lines = VGroup(*[Line(snap.get_bottom(), s.get_top(), color=BLUE_D, stroke_opacity=0.5, stroke_width=2) for s in slots])
        self.play(LaggedStart(*[AnimationGroup(Create(l), FadeIn(s[0]), FadeIn(s[1])) for l, s in zip(lines, slots)], lag_ratio=0.12))
        cap2 = caption("Each run only pays for the few pages it changes (yellow).", color=PROG)
        self.play(LaggedStart(*[FadeIn(s[2], scale=0.5) for s in slots], lag_ratio=0.1), ReplacementTransform(cap, cap2))
        self.wait(2)
        cap3 = caption("After the run: drop those pages, restore the registers, inject fresh randomness. Next tenant.")
        self.play(*[FadeOut(s[2], scale=0.5) for s in slots], ReplacementTransform(cap2, cap3))
        self.wait(2.5)

        self.play(*[FadeOut(m) for m in [boot, barrows, snap, slots, lines, cap3]])
        title = Text("Measured with the real kernel (round 6, nested KVM)", font_size=26, color=GREY_B).next_to(head, DOWN, buff=0.3)
        data = [("ready", 0.232), ("return 2", 0.484), ("one tool call", 0.503), ("10 tool calls", 0.549)]
        compare = [("today's process-per-VM path", 3.88, KERNEL), ("Hyperlight, shared snapshot", 0.37, GREY_B),
                   ("Firecracker, restored tiny Linux", 1.43, GREY_B)]
        scale = 1.15  # units per MiB
        rows = VGroup()
        for name, v in data:
            b = Rectangle(width=v * scale, height=0.38).set_fill(PROG, 0.9).set_stroke(width=0)
            rows.add(VGroup(Text(name, font_size=20), b, Text(f"{v:.2f} MiB/VM", font_size=20, color=PROG)))
        for name, v, col in compare:
            b = Rectangle(width=v * scale, height=0.38).set_fill(col, 0.6).set_stroke(width=0)
            rows.add(VGroup(Text(name, font_size=20, color=GREY_B), b, Text(f"{v:.2f} MiB/VM", font_size=20, color=col)))
        rows.arrange(DOWN, aligned_edge=LEFT, buff=0.22).next_to(title, DOWN, buff=0.35).to_edge(LEFT, buff=0.8)
        for r in rows:
            r[0].align_to(rows, LEFT)
            r[1].move_to(r[0].get_center()).align_to(LEFT * 1.2, LEFT)
            r[2].next_to(r[1], RIGHT, buff=0.2)
        self.play(FadeIn(title))
        self.play(LaggedStart(*[AnimationGroup(FadeIn(r[0]), GrowFromEdge(r[1], LEFT), FadeIn(r[2])) for r in rows], lag_ratio=0.25))
        cap4 = caption("10,000 restore cycles, zero leaks between runs. Memory: in Hyperlight's league, with a real Linux-ABI kernel.")
        self.play(Write(cap4))
        self.wait(4)

    # ------------------------------------------------------------------ 9
    def part_architecture(self):
        head = Text("The architecture today", font_size=36).to_edge(UP, buff=0.35)
        self.play(Write(head))

        agent = label_box("AI agent  (Claude Code, Cursor, Codex)", WHITE, width=6.2, height=0.6, font_size=20, fill=0.05)
        node = label_box("Node: MCP server + executor + policy  (holds credentials)", HOST, width=8.4, height=0.65, font_size=20)
        shard = RoundedRectangle(corner_radius=0.15, width=10.6, height=2.45, color=KERNEL).set_fill(KERNEL, 0.06)
        shard_lbl = Text("jitk-shard (Rust): owner threads, no credentials", font_size=20, color=KERNEL)
        stack = VGroup(agent, node, shard).arrange(DOWN, buff=0.38).next_to(head, DOWN, buff=0.25)
        shard_lbl.next_to(shard.get_top(), DOWN, buff=0.1)

        slots = VGroup()
        for i in range(4):
            wall = Rectangle(width=2.2, height=1.5, color=HW, stroke_width=4)
            k = label_box("jitk (EL1)", KERNEL, width=1.9, height=0.42, font_size=15)
            p = label_box("QuickJS / jq (EL0)", PROG, width=1.9, height=0.42, font_size=15, text_color=BLACK, fill=0.9)
            rings = Text("80 KiB rings", font_size=13, color=GREY_B)
            inner = VGroup(p, k, rings).arrange(DOWN, buff=0.1).move_to(wall)
            slots.add(VGroup(wall, inner))
        slots.arrange(RIGHT, buff=0.3).move_to(shard).shift(DOWN * 0.18)

        a1 = Arrow(agent.get_bottom(), node.get_top(), buff=0.05, color=WHITE, stroke_width=4)
        a1l = Text("MCP: execute / run", font_size=16).next_to(a1, RIGHT, buff=0.1)
        a2 = Arrow(node.get_bottom(), shard.get_top(), buff=0.05, color=HOST, stroke_width=4)
        a2l = Text("shared-memory queues", font_size=16, color=HOST).next_to(a2, RIGHT, buff=0.1)

        self.play(FadeIn(agent))
        self.play(GrowArrow(a1), FadeIn(a1l), FadeIn(node))
        self.play(GrowArrow(a2), FadeIn(a2l), Create(shard), FadeIn(shard_lbl))
        self.play(LaggedStart(*[FadeIn(s, shift=UP * 0.15) for s in slots], lag_ratio=0.2))

        side = VGroup(
            label_box("watchdog: deadlines", BAD, width=2.6, height=0.55, font_size=16, fill=0.1),
            label_box("offline: build, grow, snapshot", PLAN, width=2.6, height=0.55, font_size=16, fill=0.1),
        ).arrange(RIGHT, buff=0.3).next_to(shard, DOWN, buff=0.18).align_to(shard, RIGHT)
        self.play(FadeIn(side))

        tags = VGroup(
            status_tag(True).next_to(node, RIGHT, buff=0.15),
            status_tag(False).next_to(a2l, RIGHT, buff=0.15),
            status_tag(True).next_to(shard_lbl, RIGHT, buff=0.15),
            status_tag(False).next_to(side, LEFT, buff=0.15),
        )
        cap = caption("Green: built and measured. Gold: designed, not wired yet. (macOS today: one libkrun process per VM.)")
        self.play(FadeIn(tags), Write(cap))
        self.wait(3)

        # One request, end to end.
        steps_cap = [
            "1. The agent sends code over MCP.",
            "2. Node checks policy and hands the run to a free slot.",
            "3. The slot restores from the snapshot and runs the code.",
            "4. A tool call: the guest writes into its ring and rings the doorbell (WAIT).",
            "5. The host does the tool, writes the reply, and the guest wakes.",
            "6. FINISH: the result goes back to the agent, and the slot resets.",
        ]
        path = [agent.get_center(), node.get_center(), slots[1].get_center(), node.get_center(),
                slots[1].get_center(), agent.get_center()]
        d = Dot(color=PROG, radius=0.12).move_to(path[0])
        self.play(FadeIn(d))
        prev = cap
        for i, txt in enumerate(steps_cap):
            c = caption(txt, color=PROG if i in (3, 4) else WHITE)
            target = path[min(i + 1, len(path) - 1)] if i < 5 else path[-1]
            self.play(ReplacementTransform(prev, c), d.animate.move_to(target), run_time=1.1)
            if i == 2:
                self.play(Indicate(slots[1], color=PROG, scale_factor=1.06))
            self.wait(1.4)
            prev = c
        self.play(FadeOut(d))
        door = caption("Per slot: 16 KiB control + two 32 KiB rings. Doorbell: SUBMIT, WAIT, FINISH.", color=GREY_B)
        self.play(ReplacementTransform(prev, door))
        self.wait(3)

    # ------------------------------------------------------------------ 10
    def part_wait(self):
        head = Text("Waiting is almost free", font_size=36).to_edge(UP, buff=0.5)
        self.play(Write(head))
        grid = dot_grid(1024, cols=64, size=0.1, gap=0.05, color=PROG).shift(UP * 0.3)
        self.play(LaggedStart(*[FadeIn(s) for s in grid], lag_ratio=0.0008, run_time=2.5))
        lbl = Text("1,024 runs, each paused on a pending tool call", font_size=24).next_to(grid, DOWN, buff=0.35)
        thr = Text("held by 1 owner thread, ~0 CPU while waiting", font_size=24, color=GOOD).next_to(lbl, DOWN, buff=0.2)
        self.play(FadeIn(lbl), FadeIn(thr))
        cap = caption("A sleeping run costs memory pages, not a thread and not CPU. (measured, nested KVM)")
        self.play(Write(cap))
        self.wait(3)

    # ------------------------------------------------------------------ 11
    def part_where_we_are(self):
        head = Text("Where we honestly are", font_size=36).to_edge(UP, buff=0.5)
        self.play(Write(head))
        good = VGroup(
            Text("real kernel in the shard: ~0.5 MiB per small run", font_size=22),
            Text("10,000 restores with no leaks; 1,024 waiting runs on one thread", font_size=22),
            Text("9 unmodified native tool profiles already run", font_size=22),
            Text("hostile-guest test suites pass on today's path", font_size=22),
        )
        bad = VGroup(
            Text("Math.random repeats after restore: needs a reseed hook", font_size=22),
            Text("speed not proven: nested reset 2.5-6 ms, target under 1 ms on metal", font_size=22),
            Text("policy IPC and watchdog deadlines not wired to the shard", font_size=22),
            Text("SQLite / ripgrep need new syscalls; Go tools need threads", font_size=22),
        )
        def col(title, items, color):
            t = Text(title, font_size=26, color=color)
            bullets = VGroup(*[VGroup(Dot(color=color, radius=0.06), it).arrange(RIGHT, buff=0.15) for it in items])
            bullets.arrange(DOWN, aligned_edge=LEFT, buff=0.28)
            return VGroup(t, bullets).arrange(DOWN, aligned_edge=LEFT, buff=0.35)
        left = col("works", good, GOOD)
        right = col("not yet", bad, BAD)
        both = VGroup(left, right).arrange(DOWN, aligned_edge=LEFT, buff=0.5).next_to(head, DOWN, buff=0.4)
        both.set(width=min(both.width, 12.5))
        self.play(FadeIn(left, shift=RIGHT * 0.2))
        self.wait(2)
        self.play(FadeIn(right, shift=RIGHT * 0.2))
        self.wait(4)

    # ------------------------------------------------------------------ 12
    def part_next(self):
        v1 = Text("v1", font_size=44, color=PROG).to_edge(UP, buff=0.6)
        v1t = Text("A local MCP sandbox: agent code and real CLI tools,\n"
                   "each in a throwaway hardware-isolated computer of about 0.5 MiB.",
                   font_size=26, line_spacing=1.2).next_to(v1, DOWN, buff=0.3)
        self.play(Write(v1), FadeIn(v1t))
        self.wait(3)

        v2 = Text("v2", font_size=44, color=TEAL_B).next_to(v1t, DOWN, buff=0.7)
        v2t = Text("Computers small enough to pause, fork, and ship like a file.", font_size=26).next_to(v2, DOWN, buff=0.3)
        self.play(Write(v2), FadeIn(v2t))

        wall = Rectangle(width=1.6, height=1.2, color=HW, stroke_width=6)
        inner = label_box("run", PROG, width=1.0, height=0.45, font_size=16, text_color=BLACK, fill=0.9).move_to(wall)
        vm = VGroup(wall, inner).next_to(v2t, DOWN, buff=0.6).shift(LEFT * 3)
        self.play(FadeIn(vm))
        file_icon = VGroup(
            Polygon([-0.35, 0.45, 0], [0.2, 0.45, 0], [0.35, 0.3, 0], [0.35, -0.45, 0], [-0.35, -0.45, 0],
                    color=TEAL_B).set_fill(TEAL_B, 0.25),
            Text("~1 MiB", font_size=14),
        ).move_to(vm)
        self.play(ReplacementTransform(vm, file_icon))
        self.play(file_icon.animate.shift(RIGHT * 6), run_time=1.5)
        wall2 = Rectangle(width=1.6, height=1.2, color=HW, stroke_width=6)
        inner2 = label_box("run", PROG, width=1.0, height=0.45, font_size=16, text_color=BLACK, fill=0.9).move_to(wall2)
        vm2 = VGroup(wall2, inner2).move_to(file_icon)
        self.play(ReplacementTransform(file_icon, vm2))
        cap = caption("Pause it on one machine. Resume it, mid-line, on another.", color=TEAL_B)
        self.play(Write(cap))
        self.wait(3)
        self.play(*[FadeOut(m) for m in self.mobjects])
        end = Text("Sofort", font_size=110, color=PROG)
        tag = Text("a computer per task,\nbuilt from shared parts that grow offline",
                   font_size=28, color=GREY_B, line_spacing=1.2).next_to(end, DOWN, buff=0.4)
        self.play(Write(end), FadeIn(tag, shift=UP * 0.2))
        self.wait(3)
