package com.example.orders.support;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.function.Consumer;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * A {@link TransactionTemplate} that runs the callback at once, for use case unit tests of services that use a
 * programmatic transaction (SPRING-ARCH-07, SPRING-TEST-14). Commit and rollback are proven by the persistence ITs,
 * not here.
 */
public final class Transactions {

    private Transactions() {}

    @SuppressWarnings("unchecked")
    public static TransactionTemplate immediate() {
        TransactionTemplate template = mock(TransactionTemplate.class);
        when(template.execute(any()))
                .thenAnswer(invocation -> ((TransactionCallback<Object>) invocation.getArgument(0))
                        .doInTransaction(mock(TransactionStatus.class)));
        doAnswer(invocation -> {
                    ((Consumer<TransactionStatus>) invocation.getArgument(0)).accept(mock(TransactionStatus.class));
                    return null;
                })
                .when(template)
                .executeWithoutResult(any());
        return template;
    }
}
