package com.example.orders.support;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.function.Predicate;

/**
 * Base of in-memory fakes for outgoing ports that are pure collections (Chicago style, TEST-TDD-10; SPRING-TEST-14).
 * A fake extends it with itself as the last type argument and implements the port: {@code final class InMemoryOrders
 * extends InMemoryRepository<UUID, Order, InMemoryOrders> implements OrderPort}. Query methods filter {@link #all()}; rules the database enforces (unique keys) are repeated
 * in the fake only where a use case reacts to them, and the adapter's IT proves the real constraint.
 *
 * @param <K> id type
 * @param <T> aggregate type
 * @param <S> the fake itself, so {@link #with} chains without a cast at the call site (a return-only type parameter
 *     fails Error Prone's TypeParameterUnusedInFormals)
 */
public abstract class InMemoryRepository<K, T, S extends InMemoryRepository<K, T, S>> {

    private final Map<K, T> byId = new LinkedHashMap<>();
    private final Function<T, K> idOf;

    protected InMemoryRepository(Function<T, K> idOf) {
        this.idOf = idOf;
    }

    /** Arranges stored state: {@code orders.with(order)}. Returns this for chaining. */
    @SuppressWarnings("unchecked") // S is the subclass by construction
    public S with(T aggregate) {
        byId.put(idOf.apply(aggregate), aggregate);
        return (S) this;
    }

    /** Asserts on stored state after the use case ran. */
    public Optional<T> stored(K id) {
        return Optional.ofNullable(byId.get(id));
    }

    public int size() {
        return byId.size();
    }

    protected Optional<T> byId(K id) {
        return Optional.ofNullable(byId.get(id));
    }

    protected List<T> all() {
        return List.copyOf(byId.values());
    }

    protected Optional<T> first(Predicate<T> filter) {
        return byId.values().stream().filter(filter).findFirst();
    }

    protected void put(T aggregate) {
        byId.put(idOf.apply(aggregate), aggregate);
    }

    protected void remove(K id) {
        byId.remove(id);
    }
}
