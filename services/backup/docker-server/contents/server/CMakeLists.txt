PROJECT(backup C CXX)

cmake_minimum_required(VERSION 3.16)

set(CMAKE_RUNTIME_OUTPUT_DIRECTORY bin)

if(COMMAND cmake_policy)
  cmake_policy(SET CMP0003 NEW)
endif(COMMAND cmake_policy)

set(CMAKE_CXX_STANDARD 17)

# FIND LIBS
set(protobuf_MODULE_COMPATIBLE TRUE)
find_package(Protobuf CONFIG REQUIRED)
message(STATUS "Using protobuf ${Protobuf_VERSION}")

set(_PROTOBUF_LIBPROTOBUF protobuf::libprotobuf)
set(_PROTOBUF_PROTOC $<TARGET_FILE:protobuf::protoc>)

# gRPC building parameters
set(gRPC_BUILD_CSHARP_EXT OFF)
set(gRPC_SSL_PROVIDER "package" CACHE STRING "SSL library provider")
# Disable unused plugins
set(gRPC_BUILD_GRPC_PHP_PLUGIN OFF)
set(gRPC_BUILD_GRPC_RUBY_PLUGIN OFF)
set(gRPC_BUILD_GRPC_PYTHON_PLUGIN OFF)
set(gRPC_BUILD_GRPC_CSHARP_PLUGIN OFF)

# Find gRPC installation
# Looks for gRPCConfig.cmake file installed by gRPC's cmake installation.
find_package(gRPC CONFIG REQUIRED)
message(STATUS "Using gRPC ${gRPC_VERSION}")

set(_GRPC_GRPCPP gRPC::grpc++)
set(_GRPC_CPP_PLUGIN_EXECUTABLE $<TARGET_FILE:gRPC::grpc_cpp_plugin>)

set(BUILD_TESTING OFF CACHE BOOL "Turn off tests" FORCE)

find_package(AWSSDK REQUIRED COMPONENTS core dynamodb)

find_package(Boost 1.40 COMPONENTS program_options REQUIRED)

file(GLOB GENERATED_CODE "./_generated/*.cc")
set(DEV_SOURCE_CODE "")
set(DEV_HEADERS_PATH "")
if ($ENV{COMM_SERVICES_DEV_MODE} MATCHES 1)
  file(GLOB DEV_SOURCE_CODE "./dev/*.cpp" "./src/*.dev.cpp")
  set(DEV_HEADERS_PATH "./dev")
endif()

file(GLOB SOURCE_CODE "./src/*.cpp")
list(FILTER SOURCE_CODE EXCLUDE REGEX ".*.dev.cpp$")

foreach (ITEM ${DEV_SOURCE_CODE})
  string(REPLACE "/" ";" SPLIT_ITEM ${ITEM})
  list(GET SPLIT_ITEM -1 FILE_FULL_NAME)
  string(REPLACE ".dev.cpp" ".cpp" FILE_NAME ${FILE_FULL_NAME})
  list(FILTER SOURCE_CODE EXCLUDE REGEX ".*${FILE_NAME}$")
  list(APPEND SOURCE_CODE "${ITEM}")
endforeach()

include_directories(
  ./src
  ./src/DatabaseEntities
  ./_generated
  ${Boost_INCLUDE_DIR}
  ${DEV_HEADERS_PATH}
)

set(
  LIBS

  ${_GRPC_GRPCPP}
  ${_PROTOBUF_LIBPROTOBUF}
  gRPC::grpc++_reflection
  ${AWSSDK_LINK_LIBRARIES}
  ${Boost_LIBRARIES}
)

#SERVER
add_executable(
  backup
  
  ${GENERATED_CODE}
  
  ${SOURCE_CODE}
)

target_link_libraries(
  backup

  ${LIBS}
)

install(
  TARGETS backup
  RUNTIME DESTINATION bin/
)

# TEST
if ($ENV{COMM_TEST_SERVICES} MATCHES 1)
  file(GLOB TEST_CODE "./test/*.cpp")
  list(FILTER SOURCE_CODE EXCLUDE REGEX "./src/server.cpp")
  enable_testing()

  find_package(GTest REQUIRED)
  include_directories(
    ${GTEST_INCLUDE_DIR}
    ./test
  )

  add_executable(
    runTests

    ${GENERATED_CODE}
    ${SOURCE_CODE}
    ${TEST_CODE}
  )
  target_link_libraries(
    runTests

    ${LIBS}
    gtest
    gtest_main
  )

  add_test(
    NAME runTests
    COMMAND runTests
  )
endif()
