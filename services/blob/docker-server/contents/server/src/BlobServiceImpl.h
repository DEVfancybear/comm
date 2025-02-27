#pragma once

#include "S3Path.h"

#include "../_generated/blob.grpc.pb.h"
#include "../_generated/blob.pb.h"

#include <aws/core/Aws.h>

#include <grpcpp/grpcpp.h>

#include <string>

namespace comm {
namespace network {

class BlobServiceImpl final : public blob::BlobService::Service {
  void verifyBlobHash(
      const std::string &expectedBlobHash,
      const database::S3Path &s3Path);
  void assignVariableIfEmpty(
      const std::string &label,
      std::string &lvalue,
      const std::string &rvalue);

public:
  BlobServiceImpl();
  virtual ~BlobServiceImpl();

  grpc::Status
  Put(grpc::ServerContext *context,
      grpc::ServerReaderWriter<blob::PutResponse, blob::PutRequest> *stream)
      override;
  grpc::Status
  Get(grpc::ServerContext *context,
      const blob::GetRequest *request,
      grpc::ServerWriter<blob::GetResponse> *writer) override;
  grpc::Status Remove(
      grpc::ServerContext *context,
      const blob::RemoveRequest *request,
      google::protobuf::Empty *response) override;
};

} // namespace network
} // namespace comm
