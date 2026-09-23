-- Compatibility rollback: restore at most 500 compacted recipient payloads.
UPDATE recommendation_deliveries
SET subject = (
      SELECT payload.subject FROM recommendation_delivery_payloads payload
      WHERE payload.eventKey = recommendation_deliveries.eventKey
        AND payload.language = recommendation_deliveries.language
    ),
    bodyText = (
      SELECT payload.bodyText FROM recommendation_delivery_payloads payload
      WHERE payload.eventKey = recommendation_deliveries.eventKey
        AND payload.language = recommendation_deliveries.language
    ),
    bodyHtml = (
      SELECT payload.bodyHtml FROM recommendation_delivery_payloads payload
      WHERE payload.eventKey = recommendation_deliveries.eventKey
        AND payload.language = recommendation_deliveries.language
    ),
    metadataJson = (
      SELECT payload.metadataJson FROM recommendation_delivery_payloads payload
      WHERE payload.eventKey = recommendation_deliveries.eventKey
        AND payload.language = recommendation_deliveries.language
    ),
    updatedAt = updatedAt
WHERE id IN (
  SELECT delivery.id
  FROM recommendation_deliveries delivery
  INNER JOIN recommendation_delivery_payloads payload
    ON payload.eventKey = delivery.eventKey
   AND payload.language = delivery.language
  WHERE delivery.subject IS NULL
    AND delivery.bodyText IS NULL
    AND delivery.bodyHtml IS NULL
    AND delivery.metadataJson IS NULL
  ORDER BY delivery.id
  LIMIT 500
);
