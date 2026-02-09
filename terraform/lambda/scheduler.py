import json
import boto3
import os
import logging
from typing import Dict, Any

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients (Lambda provides AWS_REGION by default)
REGION = os.environ.get('AWS_REGION')
ec2 = boto3.client('ec2', region_name=REGION) if REGION else boto3.client('ec2')
rds = boto3.client('rds', region_name=REGION) if REGION else boto3.client('rds')

# Get instance IDs from environment variables
EC2_INSTANCE_ID = os.environ['EC2_INSTANCE_ID']
RDS_INSTANCE_ID = os.environ['RDS_INSTANCE_ID']


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler to start or stop EC2 and RDS instances.
    
    Args:
        event: Event payload containing 'action' field ('start' or 'stop')
        context: Lambda context object
        
    Returns:
        Response dictionary with status and results
    """
    action = event.get('action', '').lower()
    
    if action not in ['start', 'stop']:
        logger.error(f"Invalid action: {action}")
        return {
            'statusCode': 400,
            'body': json.dumps({
                'error': 'Invalid action. Must be "start" or "stop"'
            })
        }
    
    logger.info(f"Action: {action} resources")
    results = {
        'action': action,
        'ec2': {},
        'rds': {}
    }
    
    try:
        # Handle EC2 instance
        results['ec2'] = handle_ec2(action)
        
        # Handle RDS instance
        results['rds'] = handle_rds(action)
        
        logger.info(f"Successfully completed action: {action}")
        return {
            'statusCode': 200,
            'body': json.dumps(results, default=str)
        }
        
    except Exception as e:
        logger.error(f"Error during {action}: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'partial_results': results
            }, default=str)
        }


def handle_ec2(action: str) -> Dict[str, Any]:
    """
    Start or stop EC2 instance.
    
    Args:
        action: 'start' or 'stop'
        
    Returns:
        Dictionary with operation result
    """
    try:
        # Check current state
        response = ec2.describe_instances(InstanceIds=[EC2_INSTANCE_ID])
        current_state = response['Reservations'][0]['Instances'][0]['State']['Name']
        logger.info(f"EC2 current state: {current_state}")
        
        if action == 'stop':
            if current_state in ['running', 'pending']:
                ec2.stop_instances(InstanceIds=[EC2_INSTANCE_ID])
                logger.info(f"Stopping EC2 instance: {EC2_INSTANCE_ID}")
                return {
                    'instance_id': EC2_INSTANCE_ID,
                    'previous_state': current_state,
                    'action': 'stopped',
                    'status': 'success'
                }
            else:
                logger.info(f"EC2 instance already stopped or stopping: {current_state}")
                return {
                    'instance_id': EC2_INSTANCE_ID,
                    'state': current_state,
                    'action': 'skipped',
                    'status': 'already_stopped'
                }
                
        elif action == 'start':
            if current_state in ['stopped', 'stopping']:
                ec2.start_instances(InstanceIds=[EC2_INSTANCE_ID])
                logger.info(f"Starting EC2 instance: {EC2_INSTANCE_ID}")
                return {
                    'instance_id': EC2_INSTANCE_ID,
                    'previous_state': current_state,
                    'action': 'started',
                    'status': 'success'
                }
            else:
                logger.info(f"EC2 instance already running or starting: {current_state}")
                return {
                    'instance_id': EC2_INSTANCE_ID,
                    'state': current_state,
                    'action': 'skipped',
                    'status': 'already_running'
                }
                
    except Exception as e:
        logger.error(f"Error handling EC2: {str(e)}")
        return {
            'instance_id': EC2_INSTANCE_ID,
            'error': str(e),
            'status': 'failed'
        }


def handle_rds(action: str) -> Dict[str, Any]:
    """
    Start or stop RDS instance.
    
    Args:
        action: 'start' or 'stop'
        
    Returns:
        Dictionary with operation result
    """
    try:
        # Check current state
        response = rds.describe_db_instances(DBInstanceIdentifier=RDS_INSTANCE_ID)
        current_state = response['DBInstances'][0]['DBInstanceStatus']
        logger.info(f"RDS current state: {current_state}")
        
        if action == 'stop':
            if current_state == 'available':
                rds.stop_db_instance(DBInstanceIdentifier=RDS_INSTANCE_ID)
                logger.info(f"Stopping RDS instance: {RDS_INSTANCE_ID}")
                return {
                    'instance_id': RDS_INSTANCE_ID,
                    'previous_state': current_state,
                    'action': 'stopped',
                    'status': 'success'
                }
            else:
                logger.info(f"RDS instance not in available state: {current_state}")
                return {
                    'instance_id': RDS_INSTANCE_ID,
                    'state': current_state,
                    'action': 'skipped',
                    'status': f'not_available_{current_state}'
                }
                
        elif action == 'start':
            if current_state == 'stopped':
                rds.start_db_instance(DBInstanceIdentifier=RDS_INSTANCE_ID)
                logger.info(f"Starting RDS instance: {RDS_INSTANCE_ID}")
                return {
                    'instance_id': RDS_INSTANCE_ID,
                    'previous_state': current_state,
                    'action': 'started',
                    'status': 'success'
                }
            else:
                logger.info(f"RDS instance not in stopped state: {current_state}")
                return {
                    'instance_id': RDS_INSTANCE_ID,
                    'state': current_state,
                    'action': 'skipped',
                    'status': f'not_stopped_{current_state}'
                }
                
    except Exception as e:
        logger.error(f"Error handling RDS: {str(e)}")
        return {
            'instance_id': RDS_INSTANCE_ID,
            'error': str(e),
            'status': 'failed'
        }
