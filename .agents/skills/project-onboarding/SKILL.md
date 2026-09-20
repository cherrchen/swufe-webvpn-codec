# Skill: project-onboarding

## Purpose

让一个完全不熟悉本项目的 Coding Agent 在**最短时间内**建立可用上下文，并输出一份简短的 Context Summary 供人类复核。

## When to use

- 新 Session 首次进入项目；
- 被交接了一个陌生模块；
- 需要在不读聊天记录的前提下判断「项目现在在做什么」。

## Inputs

- 仓库本身；
- 可选的用户任务描述（若有，直接进入任务分类）。

## Steps

1. 读 [AGENTS.md](../../../AGENTS.md)（第一入口，含 Context Routing 与强制规则）。
2. 读项目身份与范围：
   - [docs/overview/project-overview.md](../../../docs/overview/project-overview.md)
   - [docs/overview/goals-and-non-goals.md](../../../docs/overview/goals-and-non-goals.md)
3. 读 [docs/README.md](../../../docs/README.md) 索引，**只为分类**，不要逐篇打开。
4. 判断当前进度：
   - [docs/planning/roadmap.md](../../../docs/planning/roadmap.md)；
   - `specs/` 下最新目录的 `spec.md` 状态字段；
   - `.agents/notes/` 中日期最新的 note（仅作为线索，不作为事实）。
5. 判定任务类型（Feature / Bug / Architecture / API / UI / Database / Testing / Documentation），按
   [context-routing.md](../../../docs/agent/context-routing.md) 读取对应最小上下文。
6. 输出 Context Summary（见下）。
7. 若发现文档与实际不一致（缺文件、状态矛盾、链接失效），**只记录并上报**，不要顺手修改。

## Output

```text
Context Summary
- Project:            <PROJECT_NAME>（<DESCRIPTION>）
- Status:             当前阶段与依据（文件路径）
- Current work:       相关 Spec 路径与状态
- Task type:          <分类>
- Context read:       <文件列表>
- Relevant rules:     <必须遵守的规则，附路径>
- Known uncertainty:  <TBD / Open Questions / 文档冲突>
- Proposed next step: <具体动作>
```

## Do not

- 不要通读整个 `docs/`（违反 [context-routing.md](../../../docs/agent/context-routing.md)）；
- 不要把 note 中的内容当作项目事实；
- 不要在此阶段修改任何代码或文档（除用户明确要求）；
- 不要用猜测填充 `TBD`。
