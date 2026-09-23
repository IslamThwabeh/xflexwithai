-- Compatibility rollback: restore at most 500 compacted recipient payloads.
UPDATE recommendation_deliveries
SET subject = (
      SELECT payload.subject FROM recommendation_delivery_payloads payload
      WHERE payload.id = recommendation_deliveries.payloadId
    ),
    bodyText = (
      SELECT payload.bodyText FROM recommendation_delivery_payloads payload
      WHERE payload.id = recommendation_deliveries.payloadId
    ),
    bodyHtml = (
      SELECT payload.bodyHtml FROM recommendation_delivery_payloads payload
      WHERE payload.id = recommendation_deliveries.payloadId
    ),
    metadataJson = (
      SELECT payload.metadataJson FROM recommendation_delivery_payloads payload
      WHERE payload.id = recommendation_deliveries.payloadId
    ),
    updatedAt = updatedAt
WHERE id IN (
  SELECT delivery.id
  FROM recommendation_deliveries delivery
  INNER JOIN recommendation_delivery_payloads payload
    ON payload.id = delivery.payloadId
  WHERE delivery.subject IS NULL
    AND delivery.bodyText IS NULL
    AND delivery.bodyHtml IS NULL
    AND delivery.metadataJson IS NULL
  ORDER BY delivery.id
  LIMIT 500
);
