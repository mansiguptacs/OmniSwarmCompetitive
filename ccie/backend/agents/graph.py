from langgraph.graph import END, StateGraph
from langgraph.checkpoint.memory import MemorySaver

from agents.orchestrator import (
    analyze_competitor_node,
    classify_node,
    discover_competitors_node,
    enrich_real_node,
    fan_out_competitors,
    landscape_synthesis_node,
    parse_hypothetical_node,
    route_after_classify,
)
from state import CCIEState


def build_orchestrator_graph():
    graph = StateGraph(CCIEState)

    graph.add_node("classify", classify_node)
    graph.add_node("enrich_real", enrich_real_node)
    graph.add_node("parse_hypothetical", parse_hypothetical_node)
    graph.add_node("discover", discover_competitors_node)
    graph.add_node("analyze_competitor", analyze_competitor_node)
    graph.add_node("synthesize", landscape_synthesis_node)

    graph.set_entry_point("classify")
    graph.add_conditional_edges(
        "classify",
        route_after_classify,
        {
            "enrich_real": "enrich_real",
            "parse_hypothetical": "parse_hypothetical",
        },
    )
    graph.add_edge("enrich_real", "discover")
    graph.add_edge("parse_hypothetical", "discover")
    graph.add_conditional_edges("discover", fan_out_competitors, ["analyze_competitor"])
    graph.add_edge("analyze_competitor", "synthesize")
    graph.add_edge("synthesize", END)

    return graph


def build_echo_graph():
    from agents.orchestrator import echo_ack_node

    graph = StateGraph(CCIEState)
    graph.add_node("echo", echo_ack_node)
    graph.set_entry_point("echo")
    graph.add_edge("echo", END)
    return graph


def compile_graph(*, echo: bool = False):
    builder = build_echo_graph() if echo else build_orchestrator_graph()
    checkpointer = MemorySaver()
    return builder.compile(checkpointer=checkpointer)
