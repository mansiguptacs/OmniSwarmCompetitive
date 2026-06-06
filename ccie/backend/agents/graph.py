from langgraph.graph import END, StateGraph
from langgraph.checkpoint.memory import MemorySaver

from agents.orchestrator import (
    analyze_competitors_node,
    classify_node,
    discover_competitors_node,
    landscape_synthesis_node,
)
from state import CCIEState


def build_orchestrator_graph():
    graph = StateGraph(CCIEState)

    graph.add_node("classify", classify_node)
    graph.add_node("discover", discover_competitors_node)
    graph.add_node("analyze", analyze_competitors_node)
    graph.add_node("synthesize", landscape_synthesis_node)

    graph.set_entry_point("classify")
    graph.add_edge("classify", "discover")
    graph.add_edge("discover", "analyze")
    graph.add_edge("analyze", "synthesize")
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
