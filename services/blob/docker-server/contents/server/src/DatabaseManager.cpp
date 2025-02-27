#include "DatabaseManager.h"
#include "Tools.h"

#include <aws/core/utils/Outcome.h>
#include <aws/dynamodb/model/QueryRequest.h>
#include <aws/dynamodb/model/ScanRequest.h>

#include <iostream>
#include <vector>

namespace comm {
namespace network {
namespace database {

DatabaseManager &DatabaseManager::getInstance() {
  static DatabaseManager instance;
  return instance;
}

void DatabaseManager::innerPutItem(
    std::shared_ptr<Item> item,
    const Aws::DynamoDB::Model::PutItemRequest &request) {
  const Aws::DynamoDB::Model::PutItemOutcome outcome =
      getDynamoDBClient()->PutItem(request);
  if (!outcome.IsSuccess()) {
    throw std::runtime_error(outcome.GetError().GetMessage());
  }
}

void DatabaseManager::innerRemoveItem(
    const Item &item,
    const std::string &key) {
  Aws::DynamoDB::Model::DeleteItemRequest request;
  request.SetTableName(item.getTableName());
  request.AddKey(
      item.getPrimaryKey(), Aws::DynamoDB::Model::AttributeValue(key));

  const Aws::DynamoDB::Model::DeleteItemOutcome &outcome =
      getDynamoDBClient()->DeleteItem(request);
  if (!outcome.IsSuccess()) {
    throw std::runtime_error(outcome.GetError().GetMessage());
  }
}

void DatabaseManager::putBlobItem(const BlobItem &item) {
  Aws::DynamoDB::Model::PutItemRequest request;
  request.SetTableName(BlobItem::tableName);
  request.AddItem(
      BlobItem::FIELD_BLOB_HASH,
      Aws::DynamoDB::Model::AttributeValue(item.getBlobHash()));
  request.AddItem(
      BlobItem::FIELD_S3_PATH,
      Aws::DynamoDB::Model::AttributeValue(item.getS3Path().getFullPath()));
  request.AddItem(
      BlobItem::FIELD_CREATED,
      Aws::DynamoDB::Model::AttributeValue(
          std::to_string(getCurrentTimestamp())));

  this->innerPutItem(std::make_shared<BlobItem>(item), request);
}

std::shared_ptr<BlobItem>
DatabaseManager::findBlobItem(const std::string &blobHash) {
  Aws::DynamoDB::Model::GetItemRequest request;
  request.AddKey(
      BlobItem::FIELD_BLOB_HASH,
      Aws::DynamoDB::Model::AttributeValue(blobHash));
  return std::move(this->innerFindItem<BlobItem>(request));
}

void DatabaseManager::removeBlobItem(const std::string &blobHash) {
  this->innerRemoveItem(*(createItemByType<BlobItem>()), blobHash);
}

void DatabaseManager::putReverseIndexItem(const ReverseIndexItem &item) {
  if (this->findReverseIndexItemByHolder(item.getHolder()) != nullptr) {
    throw std::runtime_error(
        "An item for the given holder [" + item.getHolder() +
        "] already exists");
  }
  Aws::DynamoDB::Model::PutItemRequest request;
  request.SetTableName(ReverseIndexItem::tableName);
  request.AddItem(
      ReverseIndexItem::FIELD_HOLDER,
      Aws::DynamoDB::Model::AttributeValue(item.getHolder()));
  request.AddItem(
      ReverseIndexItem::FIELD_BLOB_HASH,
      Aws::DynamoDB::Model::AttributeValue(item.getBlobHash()));

  this->innerPutItem(std::make_shared<ReverseIndexItem>(item), request);
}

std::shared_ptr<ReverseIndexItem>
DatabaseManager::findReverseIndexItemByHolder(const std::string &holder) {
  Aws::DynamoDB::Model::GetItemRequest request;
  request.AddKey(
      ReverseIndexItem::FIELD_HOLDER,
      Aws::DynamoDB::Model::AttributeValue(holder));

  return std::move(this->innerFindItem<ReverseIndexItem>(request));
}

std::vector<std::shared_ptr<database::ReverseIndexItem>>
DatabaseManager::findReverseIndexItemsByHash(const std::string &blobHash) {
  std::vector<std::shared_ptr<database::ReverseIndexItem>> result;

  Aws::DynamoDB::Model::QueryRequest req;
  req.SetTableName(ReverseIndexItem::tableName);
  req.SetKeyConditionExpression("blobHash = :valueToMatch");

  AttributeValues attributeValues;
  attributeValues.emplace(":valueToMatch", blobHash);

  req.SetExpressionAttributeValues(attributeValues);
  req.SetIndexName("blobHash-index");

  const Aws::DynamoDB::Model::QueryOutcome &outcome =
      getDynamoDBClient()->Query(req);
  if (!outcome.IsSuccess()) {
    throw std::runtime_error(outcome.GetError().GetMessage());
  }
  const Aws::Vector<AttributeValues> &items = outcome.GetResult().GetItems();
  for (auto &item : items) {
    result.push_back(std::make_shared<database::ReverseIndexItem>(item));
  }

  return result;
}

bool DatabaseManager::removeReverseIndexItem(const std::string &holder) {
  std::shared_ptr<database::ReverseIndexItem> item =
      findReverseIndexItemByHolder(holder);
  if (item == nullptr) {
    return false;
  }
  this->innerRemoveItem(*item, item->getHolder());
  return true;
}

} // namespace database
} // namespace network
} // namespace comm
